# builder image step
FROM node:16 as builder
WORKDIR /iris
COPY . /iris

# install packages
ARG NPM_TOKEN
RUN echo "//npm.pkg.github.com/:_authToken=$NPM_TOKEN" > ~/.npmrc
RUN yarn

# lean output image
FROM node:16.8-alpine3.14
ARG GIT_COMMIT=unspecified
ARG GIT_BRANCH=unspecified
ARG NODE_ENV
LABEL git_commit=${GIT_COMMIT}
LABEL git_branch=${GIT_BRANCH}

WORKDIR /iris
COPY --from=builder /iris/ /iris/
EXPOSE 3001
ENV NO_COLOR=true
ENV COMMIT_SHA=${GIT_COMMIT}
ENV BRANCH=${GIT_BRANCH}
ENV NODE_ENV=$NODE_ENV
CMD "yarn" "start"
