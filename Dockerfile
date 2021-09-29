# builder image step
FROM node:16 as builder
WORKDIR /hepius
COPY . /hepius
RUN yarn

# lean output image
FROM node:16.8-alpine3.14
ARG GIT_COMMIT=unspecified
ARG GIT_BRANCH=unspecified
LABEL git_commit=${GIT_COMMIT}
LABEL git_branch=${GIT_BRANCH}

WORKDIR /hepius
COPY --from=builder /hepius/ /hepius/
EXPOSE 3000
ENV NO_COLOR=true
ENV COMMIT_SHA=${GIT_COMMIT}
ENV BRANCH=${GIT_BRANCH}
ENV NODE_ENV=development
CMD "yarn" "start"
