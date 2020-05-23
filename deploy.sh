#!/bin/bash

export NODE_ENV=production

echo "Building site..."
rm -rf .next && yarn build

echo "Compressing directory ..."
tar --exclude=".git" --exclude="node_modules" -zcf ../piano.tar.gz ./

echo "Uploading tar to server ..."
scp ../piano.tar.gz root@lacke.mn:/var/www/piano/build/

echo "Decompressing tar on server ..."
ssh root@lacke.mn 'cd /var/www/piano/build && tar xzf piano.tar.gz && yarn --production && cd .. && rm current && ln -s build current'

echo "Restarting server ..."
ssh root@lacke.mn 'supervisorctl restart piano:*'
