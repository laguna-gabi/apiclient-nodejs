<p align="center">
  <a href="https://en.wikipedia.org/wiki/Iris_(mythology)" target="blank"><img src="https://upload.wikimedia.org/wikipedia/commons/a/aa/Winged_goddess_Cdm_Paris_392.jpg" height="250" alt="Iris" /></a>
</p>

# 📨 Iris

Laguna health messages component.
<br/>Written in typescript by using [Nest](https://github.com/nestjs/nest) framework.

- [📨 Iris](#-iris)
   * [💡 Project introduction](#-project-introduction)
      + [entities](#entities)
   * [📋 Prerequisites](#-prerequisites)
      + [Installation](#installation)
      + [Docker](#docker)
      + [Aws](#aws)
      + [Shared code settings](#shared-code-settings)
   * [🚀 Running the app](#-running-the-app)
   * [🧪 Testing the app](#-testing-the-app)
   * [🎻 Troubleshooting](#-troubleshooting)
      + [How to view the db locally](#how-to-view-the-db-locally)
      + [Error at connection to mongo locally](#error-at-connection-to-mongo-locally)

## 💡 Project introduction

This project handles all the messages' logic for laguna-health.
<br/>**All** messages to members, users, etc.. will be sent from this component.

- We're using mongodb (with [replica set](https://docs.mongodb.com/manual/replication/)) in order to store our data.
- We're using aws sqs in order to receive messages from Laguna Health services.

### entities

The main entities in our system:

## 📋 Prerequisites

### Installation

install all dependencies in [package.json](./package.json) file by running the following command:

```bash
$ yarn
```

### Docker

We're loading a local mongodb by using [docker](https://hub.docker.com/).

1. install [docker](https://docs.docker.com/get-docker/).
2. run `docker-compose up -d` for [starting docker](./docker-compose.yml) with mongodb replica set(localhost).
   > **_Stop:_** After running the sample, you can stop the Docker container with `docker-compose down` <br/>

### Aws

In order to work locally with aws cli and `package.json` dependencies, install

1. install [aws cli](https://docs.aws.amazon.com/cli/latest/userguide/install-cliv2-mac.html) (will be easy for working with aws on terminal)
2. [set up](https://docs.aws.amazon.com/sdk-for-java/v1/developer-guide/setup-credentials.html) credentials on your local computer (make sure to set region to `us-east-1`)
   > **_Don't skip aws setup:_** This step is critical to develop locally on this project.
   > We're loading configurations(api keys and tokens for external providers such as
   > [sendbird](https://sendbird.com), [onesignal](https://onesignal.com), [twilio](https://www.twilio.com), etc...)
   > from [aws secrets manager](https://aws.amazon.com/secrets-manager/).

### Shared code settings

1. Set up your ide to run with `.prettierrc` file which exists on the main root of the project.
2. Set up your ide to run with `.eslintrc.js` file which exists on the main root of the project.

## 🚀 Running the app

In order to work with _iris_:

1. init and load local mongodb as described on [docker section](#docker)
2. start the server by using one of the following methods:
   <br/>2a. run `yarn start` or `yarn start:watch` if you just want to use _iris_ locally

## 🧪 Testing the app

```bash
# unit tests
$ yarn test
```

## 🎻 Troubleshooting

### How to view the db locally

1. Download and install [robomongo](https://robomongo.org/download) or any other mongodb visualizer you like
2. Set up local connection to : `mongodb://localhost:27020,localhost:27021`, as defined on [db.module.ts](./src/db/db.module.ts)
   ! there's no need for authentication when connecting locally to mongodb

### Error at connection to mongo locally

```text
[MongooseModule] Unable to connect to the database. Retrying (1)
connect ECONNREFUSED 127.0.0.1:27020
```

An instance of mongo is not running locally, go over [docker section](#docker) again.
