#!/bin/bash

# build mService(s) Docker images
docker build -f apps/iris/Dockerfile -t iris .
docker build -f apps/hepius/Dockerfile -t hepius .
