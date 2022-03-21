<p align="center">
  <a href="https://en.wikipedia.org/wiki/Argus_Panoptes" target="blank">
      <img src="https://media.gettyimages.com/photos/mercury-argus-and-io-14921494-found-in-the-collection-of-appartamenti-picture-id1195082483?s=2048x2048" 
       height="200" 
       alt="Hepius" />
  </a>
</p>

# 👁 Argus

Laguna health backend monorepo, powered by [nx](https://nx.dev/getting-started/intro).

This Monorepo contains the following:

|               Name                | Type |                                                                                                          Coverage                                                                                                           |
| :-------------------------------: | :--: | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------: |
|  [Hepius](apps/hepius/README.md)  | app  | <a href="https://laguna-health-coverage.s3.amazonaws.com/hepius/develop/lcov-report/index.html" alt="lines"><img src="https://laguna-health-coverage.s3.amazonaws.com/hepius/develop/badge-lines.svg?branch=develop" /></a> |
|    [Iris](apps/iris/README.md)    | app  |   <a href="https://laguna-health-coverage.s3.amazonaws.com/iris/develop/lcov-report/index.html" alt="lines"><img src="https://laguna-health-coverage.s3.amazonaws.com/iris/develop/badge-lines.svg?branch=develop" /></a>   |
| [Pandora](libs/pandora/README.md) | lib  | <a href="https://laguna-health-coverage.s3.amazonaws.com/pandora/master/lcov-report/index.html" alt="lines"><img src="https://laguna-health-coverage.s3.amazonaws.com/pandora/master/badge-lines.svg?branch=master" /></a>  |

---

## table of contents

- [👁 Argus](#-argus)
  - [💡 Project introduction](#-project-introduction)
  - [📋 Prerequisites](#-prerequisites)
    - [Node](#node)
    - [Docker](#docker)
    - [Aws](#aws)
    - [Shared code settings](#shared-code-settings)
  - [🐬 NX](#-nx)

---

## 💡 Project introduction

This repo contains all the projects that handles the backend logic for laguna-health.

- hepius is used for all the http graphql requests
- iris handles all the messaging

---

## 📋 Prerequisites

### Node

download [`node`](https://nodejs.org/en/download/), it will also download `npm` node package manager.
next download the following using npm:<br/>
`typescript`, `yarn` and `nx`

```bash
$ npm install -g typescript
$ npm install -g yarn
$ npm install -g nx
```

install all dependencies in [package.json](./package.json) file by running the following command:

```bash
$ yarn
```

### Docker

we are using docker to work locally with `mongodb` our database and `localstack` AWS emulator to use AWS services locally.

1. download [docker](https://docs.docker.com/get-docker/).
2. to start docker run: `docker-compose up -d` this will start [docker-compose](./docker-compose.yml) with 2 mongodb instances(localhost and test) and an instance of localstack(local AWS emulator).
   > To stop the running containers you can run: `docker-compose down`.<br/>
3. to configure localstack run: `nx localstack` this will configure three _sqs_ queues and one _s3_ bucket.

   > **_Troubleshooting_**: if the docker fails to start you could check the logs running: `docker-compose logs -f`.<br/>
   > Its possible that all the docker volumes are full you could run the following to clear all the volumes: `docker-compose down && docker volume rm $(docker volume ls -q)`.

### Aws

In order to work locally with AWS you need AWS cli.

1. install [aws cli](https://docs.aws.amazon.com/cli/latest/userguide/install-cliv2-mac.html) (will be easy for working with aws on terminal)
2. [set up](https://docs.aws.amazon.com/sdk-for-java/v1/developer-guide/setup-credentials.html) credentials on your local computer (make sure to set region to `us-east-1`)
   > **_Don't skip aws setup:_** This step is critical to develop locally on this project.
   > We're loading configurations(api keys and tokens for external providers such as [sendbird](https://sendbird.com), [onesignal](https://onesignal.com), [twilio](https://www.twilio.com), etc...) from [aws secrets manager](https://aws.amazon.com/secrets-manager/).

### Shared code settings

Our team has certain conventions of how are code should look, to help us all stay on the same page we have the following tools that help us.

1. `.prettierrc` configuration file for `prettier` a tool that formats our code.
2. `.eslintrc.js` configuration file for `eslint` a tool that adds rules to the way our code is written.
3. `.editorconfig` configuration file for `editorconfig` tool that configures the IDE (indent, new lines etc..).

Your IDE probably has extensions to help you with those tools

> vscode - [prettier](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode), [eslint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint), [editorconfig](https://marketplace.visualstudio.com/items?itemName=EditorConfig.EditorConfig)<br/>
> WebStorm - [prettier](https://plugins.jetbrains.com/plugin/10456-prettier), [eslint](https://plugins.jetbrains.com/plugin/7494-eslint), [editorconfig](https://plugins.jetbrains.com/plugin/7294-editorconfig)

---

## 🐬 NX
