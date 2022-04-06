#!/bin/bash

set -e

if [[ "$NODE_ENV" == "production" ]]
then
  echo "PROD"

  rm -rf dist
  cd adapters/wc1
  npm install
  node esbuild.js
  cd ../..

  cd adapters/trezor
  npm install
  node esbuild.js
  cd ../..

  node esbuild.js
  npx tailwindcss -c tailwind.config.cjs -i src/main.css -o dist/v1/loginwith.css --minify
  cp src/*.html dist/v1

  ls -l dist/v1
else
  echo "NOT PROD"

  _term() {
    echo "caught SIGTERM"
    kill -TERM "$p1" 2> /dev/null
    kill -TERM "$p2" 2> /dev/null
    kill -TERM "$p3" 2> /dev/null
  }

  trap _term SIGTERM
  trap _term SIGINT

  p1=0
  p2=0
  p3=0

  node esbuild.js &
  p1=$!
  echo "esbuild pid $p1"

  /bin/echo bin echo &

  npx tailwindcss -c tailwind.config.cjs -i src/main.css -o dist/v1/loginwith.css --watch &
  p2=$!
  echo "tailwindcss pid $p2"

  watcher src /bin/cp src/iframe.html dist/v1/ &
  p3=$!
  echo "watcher pid $p3"

  wait
fi
