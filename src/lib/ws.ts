/**
 * WebSocket Events
 *
 * @format
 */

/**
 * Point
 */
export interface IPoint {
  x: number
  y: number
}

/**
 * Game Event Types
 */
export enum GameEventType {
  Play,
  Stop,
  Watchers,
}

/**
 * Game Event
 */
export interface IGameEvent<T> {
  type: GameEventType
  message: T
}
