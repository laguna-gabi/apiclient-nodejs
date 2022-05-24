#!/bin/bash

# build and create a docker images for all services
nx run-many --target=dockerize --all
docker-compose -f docker-compose.services.yml up -d
