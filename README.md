<p align="center">
  <a href="https://en.wikipedia.org/wiki/Argus_Panoptes" target="blank">
    <img src="https://media.gettyimages.com/photos/mercury-argus-and-io-14921494-found-in-the-collection-of-appartamenti-picture-id1195082483?s=2048x2048" 
      height="200" 
      alt="Argus" />
  </a><br/>
    <a href="https://github.com/LagunaHealth/argus/actions">
    <img src="https://github.com/LagunaHealth/argus/workflows/Laguna%20Auto/badge.svg" alt="Develop ci/cd status." />
  </a>
  <a href="https://github.com/LagunaHealth/argus/contributors" alt="Contributors">
    <img src="https://img.shields.io/github/contributors/badges/shields" />
  </a>
</p>

# 👁 Argus

Laguna health's backend monorepo.

This Monorepo contains the following:

<div align=“center”>

|                 Name                  | Type |                                                                      Coverage                                                                       |
| :-----------------------------------: | :--: | :-------------------------------------------------------------------------------------------------------------------------------------------------: |
|         [Hepius](apps/hepius)         | app  |     <a href="" alt="lines"><img src="https://laguna-health-coverage.s3.amazonaws.com/hepius/badge-lines.svg?branch=develop&kill_cache=1" /></a>     |
|           [Iris](apps/iris)           | app  |      <a href="" alt="lines"><img src="https://laguna-health-coverage.s3.amazonaws.com/iris/badge-lines.svg?branch=develop&kill_cache=1" /></a>      |
|       [Poseidon](apps/poseidon)       | app  |    <a href="" alt="lines"><img src="https://laguna-health-coverage.s3.amazonaws.com/poseidon/badge-lines.svg?branch=develop&kill_cache=1" /></a>    |
|        [Pandora](libs/pandora)        | lib  |    <a href="" alt="lines"><img src="https://laguna-health-coverage.s3.amazonaws.com/pandora/badge-lines.svg?branch=develop&kill_cache=1" /></a>     |
|     [IrisClient](libs/irisClient)     | lib  |   <a href="" alt="lines"><img src="https://laguna-health-coverage.s3.amazonaws.com/irisClient/badge-lines.svg?branch=develop&kill_cache=1" /></a>   |
| [PoseidonClient](libs/poseidonClient) | lib  | <a href="" alt="lines"><img src="https://laguna-health-coverage.s3.amazonaws.com/poseidonClient/badge-lines.svg?branch=develop&kill_cache=1" /></a> |

</div>

---

## table of contents

- [👁 Argus](#-argus)
  - [table of contents](#table-of-contents)
  - [💡 Project introduction](#-project-introduction)
  - [📋 Prerequisites](#-prerequisites)
    - [Node](#node)
    - [Docker](#docker)
    - [Aws](#aws)
    - [Shared code settings](#shared-code-settings)
  - [🔄 ci/cd](#-cicd)
  - [🐬 NX](#-nx)
    - [Running commands](#running-commands)

---

## 💡 Project introduction

This repo contains all the projects that handles the backend logic for laguna-health.

- [hepius](./apps/hepius) is used for all the http graphql requests
- [iris](./apps/iris) handles all the messaging
- [pandora](./libs/pandora) is an internal library used for common code of hepius and iris.

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

**_How to view the db locally?_**

> 1. Download and install [mongodb compass](https://www.mongodb.com/try/download/compass)/[robomongo](https://robomongo.org/download) or any other mongodb visualizer you like
> 2. Set up local connection to: `mongodb://localhost:27017/laguna` for localhost and `mongodb://localhost:27018/test`.<br/>
>    there's no need for authentication when connecting locally to mongodb

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

## 🔄 ci/cd

`Argus` supports a manual workflow by which developers can trigger a manual flow.
The flow can be triggered for any branch however, only `develop` and `master` branches will allow deployment and migration phase to run under the restriction that `test` and `lint` where enabled.

Simply go to the Github Actions page in `Argus` and select the `Laguna Manual` - [link](https://github.com/LagunaHealth/argus/actions/workflows/ci.manual.yml).

## 🐬 NX

This monorepo is built on top of [nx](https://nx.dev/) a smart, fast and extensible build system tool.

### Running commands

```bash
# command structure
nx [command] [projectName]

# example of running a command
$ nx test:cov hepius
```

**_Affected_**

[Affected](https://nx.dev/using-nx/affected) is a powerful tool that helps us determine what projects were affected by any changes in the commit.

```bash
# running affected
nx affected --target=test:cov --base=develop --parallel=3
```

This command will do the following: it will run the command `test:cov` for every affected project,<br/>
the affected will be calculated by comparing the current branch to `develop` branch and the tests will run in parallel with `3` runners.

Affected does not only check the files changed but also the dependencies, if a library was changed the apps that depend on that library will also be affected.

**_caching_**

Nx also provides smart caching, there is a list of cashable commands can be seen in [nx.json](./nx.json) under `cacheableOperations`.<br/>
when those commands are run they are cached with the current git commit, if you run the same command with no changes in the repo the results will be taken from the cache
