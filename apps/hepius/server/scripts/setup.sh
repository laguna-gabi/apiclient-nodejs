#!/bin/bash

docker-compose down && docker volume rm $(docker volume ls -q)
docker-compose up -d
# sleeps 2 seconds in order to wait for the docker to initialise
sleep 2
nx localstack
yarn seed
yarn get:tokens
