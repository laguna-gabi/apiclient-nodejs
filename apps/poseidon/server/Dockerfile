FROM node:16.13-bullseye-slim as builder
COPY config ./poseidon/config
WORKDIR /poseidon
COPY ./dist/apps/poseidon .
COPY config ./poseidon/config
RUN yarn

# lean output image
FROM node:16.13-bullseye-slim
ARG GIT_COMMIT=unspecified
ARG GIT_BRANCH=unspecified
ARG NODE_ENV
LABEL git_commit=${GIT_COMMIT}
LABEL git_branch=${GIT_BRANCH}

WORKDIR /poseidon
COPY --from=builder /poseidon/ /poseidon/
EXPOSE 3003
EXPOSE 4003
ENV NO_COLOR=true
ENV COMMIT_SHA=${GIT_COMMIT}
ENV BRANCH=${GIT_BRANCH}
ENV NODE_ENV=$NODE_ENV
CMD node ./main.js
