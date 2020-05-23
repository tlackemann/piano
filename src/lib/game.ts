/** @format */

import { interaction, Application, Container, Sprite, Texture } from 'pixi.js'
import * as Tone from 'tone'

import createLogger from 'lib/log'
import { IGameEvent, GameEventType } from 'lib/ws'

const log = createLogger(__filename)
const synth = new Tone.Synth().toMaster()

/**
 * Colors for assigned keys
 */
const PIANO_KEY_COLORS = [0xe0fefe, 0xc7ceea, 0xffdac1, 0xff9aa2, 0xffffd8, 0xb5ead7]

/**
 * Keys on a piano
 * Assume sharps (yes I know there are flats, yes I know music theory is immesely complicated)
 *
 */
const PIANO_KEYS = ['c', 'c#', 'd', 'd#', 'e', 'f', 'f#', 'g', 'g#', 'a', 'a#', 'b']

type PianoSprite = Sprite & {
  meta: { key: string; octave: number; playing: boolean; playingColor: number }
}
type PianoContainer = Container & { pointerDown: boolean }

type KeyPlayEvent = (key: string, octave: number) => void

/**
 * Game
 */
export class Game {
  app: Application

  /**
   * Total number of keys to render, starting from "middle C"
   */
  private keyCount: number = 52

  /**
   * We want to be able to "slide" on the keyboard
   * When the pointer moves and this flag is set, we'll allowing playing the next hovered key
   */
  private pointerDown: boolean = false

  /**
   * Callback event when a key is played
   * Used to send a websocket event outside the context of the game library
   */
  private _onKeyPlay?: KeyPlayEvent
  private _onKeyStop?: KeyPlayEvent

  /**
   * Constructor
   */
  constructor(view: HTMLCanvasElement) {
    this.app = new Application({ view, resizeTo: window })
    this.app.stage.interactive = true

    this.app.renderer.backgroundColor = 0xffffff

    this.app.stage.on('pointerdown', () => {
      this.pointerDown = true
    })

    this.app.stage.on('pointerup', () => {
      this.pointerDown = false
    })

    this.app.ticker.add(this.render)

    this.createPianoKeys()
  }

  /**
   * Destroy
   */
  destroy = () => {
    this.app.destroy(true)
  }

  /**
   * Callback when a key is played
   */
  onKeyPlay = (callback: KeyPlayEvent) => {
    this._onKeyPlay = callback
  }

  /**
   * Callback when a key is stopped
   */
  onKeyStop = (callback: KeyPlayEvent) => {
    this._onKeyStop = callback
  }

  /**
   * Create piano keys, reate an even amount of keys to left and right of "middle C"
   */
  private createPianoKeys = () => {
    const totalKeys = PIANO_KEYS.length
    for (let i = 0; i < this.keyCount; ++i) {
      const octave = Math.floor(i / totalKeys) + 1
      this.drawPianoKey(PIANO_KEYS[i % totalKeys], octave, i)
    }
  }

  /**
   * Draw a white key
   */
  private drawPianoKey(key: string, octave: number, position: number) {
    const sprite = new Sprite(Texture.WHITE) as PianoSprite
    sprite.meta = {
      key,
      octave,
      playing: false,
      playingColor: PIANO_KEY_COLORS[position % PIANO_KEY_COLORS.length],
    }

    // size the key so all keys fit snug across the entire canvas
    const height = this.app.renderer.view.height / 2
    const width = this.app.renderer.view.width / this.keyCount
    sprite.height = width * 8
    sprite.width = width

    // black key
    if (this.isBlackKey(key)) {
      sprite.tint = 0x000000
    }

    sprite.position.set(width * position, height - sprite.height / 2)
    sprite.interactive = true
    sprite.buttonMode = true

    sprite.on('pointerover', this.onPointerOver)
    sprite.on('pointerdown', this.onPointerDown)
    sprite.on('pointerup', this.onPointerUp)
    sprite.on('pointerupoutside', this.onPointerUp)
    sprite.on('pointerout', this.onPointerUp)

    this.app.stage.addChild(sprite)
  }

  /**
   * Is the passed key a black key?
   */
  private isBlackKey = (key: string) => /\#/.test(key)

  /**
   * Piano Key Events
   * Note: Methods do *not* use arrow functions so that we can access to local "this" (PianoSprite)
   */

  private onPointerDown = (event: interaction.InteractionEvent) => {
    const sprite = event.currentTarget as PianoSprite

    if (!this.isPlaying(sprite.meta.key, sprite.meta.octave)) {
      log.info('key down %s%d', sprite.meta.key, sprite.meta.octave)

      if (this._onKeyPlay) {
        this._onKeyPlay(sprite.meta.key, sprite.meta.octave)
      }
    }
  }

  private onPointerUp = (event: interaction.InteractionEvent) => {
    const sprite = event.currentTarget as PianoSprite

    if (this.isPlaying(sprite.meta.key, sprite.meta.octave)) {
      log.info('key up %s%d', sprite.meta.key, sprite.meta.octave)

      if (this._onKeyStop) {
        this._onKeyStop(sprite.meta.key, sprite.meta.octave)
      }
    }
  }

  private onPointerOver = (event: interaction.InteractionEvent) => {
    const sprite = event.currentTarget as PianoSprite

    if (this.pointerDown && !this.isPlaying(sprite.meta.key, sprite.meta.octave)) {
      log.info('key over %s%d', sprite.meta.key, sprite.meta.octave)

      if (this._onKeyPlay) {
        this._onKeyPlay(sprite.meta.key, sprite.meta.octave)
      }
    }
  }

  private playing: string[] = []

  private isPlaying = (key: string, octave: number) => this.playing.indexOf(`${key}${octave}`) >= 0

  startPlaying = (key: string, octave: number) => {
    this.playing.push(`${key}${octave}`)
    //play a middle 'C' for the duration of an 8th note
    synth.triggerAttack(`${key}${octave}`)
  }

  stopPlaying = (key: string, octave: number) => {
    this.playing = this.playing.filter(k => k !== `${key}${octave}`)
    synth.triggerRelease()
  }

  private render = () => {
    for (let i = 0, length = this.app.stage.children.length; i < length; ++i) {
      const sprite = this.app.stage.children[i] as PianoSprite
      const {
        meta: { playingColor, playing, key, octave },
      } = sprite

      if (this.isPlaying(key, octave)) {
        sprite.tint = playingColor
      } else {
        sprite.tint = !this.isBlackKey(key) ? 0xffffff : 0x000000
      }
    }
  }
}

/**
 * Initialize the game
 */
export default (view: HTMLCanvasElement) => new Game(view)
