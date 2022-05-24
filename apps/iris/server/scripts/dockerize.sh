#!/bin/bash

# build mService(s) Docker images
docker build -f apps/iris/Dockerfile -t iris .
