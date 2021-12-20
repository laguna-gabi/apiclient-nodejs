#!/bin/bash
#
# Usage:
#    "source buildandpush.sh"
#   or if file permissions are setup as executable:
#    "./buildandpush.sh" 

set -o errexit

# setting up variables
readonly name=hepius
readonly region=us-east-1
readonly ecr_url=757492387178.dkr.ecr.us-east-1.amazonaws.com
readonly git_commit=$(git log -1 --format=%H)
readonly git_branch=$(git branch --show-current)
readonly repo=${name}-${git_branch}

# ECR authentication (https://docs.aws.amazon.com/AmazonECR/latest/userguide/registry_auth.html)
aws ecr get-login-password --region ${region} | docker login --username AWS --password-stdin ${ecr_url}

# build the image
docker build -t ${repo} --build-arg GIT_COMMIT=${git_commit} --build-arg GIT_BRANCH=${git_branch} --build-arg NPM_TOKEN=<npm token to install pandora> --build-arg NODE_ENV=<development/producation> .

# tag & push to ECR (https://docs.aws.amazon.com/AmazonECR/latest/userguide/docker-push-ecr-image.html)
docker tag ${repo}:latest ${ecr_url}/${repo}:latest
docker tag ${repo}:latest ${ecr_url}/${repo}:${git_commit}
docker push ${ecr_url}/${repo}:latest
docker push ${ecr_url}/${repo}:${git_commit}
