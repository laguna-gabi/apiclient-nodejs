# builder image step
FROM node:16 as builder
WORKDIR /hepius
COPY . /hepius

# install packages
ARG NPM_TOKEN
RUN echo "//npm.pkg.github.com/:_authToken=$NPM_TOKEN" > ~/.npmrc
RUN echo "arch=x64" >> ~/.npmrc
RUN echo "platform=linux" >> ~/.npmrc
RUN yarn

# lean output image
FROM node:16.13-bullseye-slim
ARG GIT_COMMIT=unspecified
ARG GIT_BRANCH=unspecified
ARG NODE_ENV
LABEL git_commit=${GIT_COMMIT}
LABEL git_branch=${GIT_BRANCH}

WORKDIR /hepius
COPY --from=builder /hepius/ /hepius/
EXPOSE 3000
ENV NO_COLOR=true
ENV COMMIT_SHA=${GIT_COMMIT}
ENV BRANCH=${GIT_BRANCH}
ENV NODE_ENV=$NODE_ENV
CMD "yarn" "start"