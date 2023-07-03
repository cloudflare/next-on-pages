#!/bin/sh
cd pages-e2e;
which nvm && nvm use;
npm run test;
