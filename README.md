<p align="center">
  <a href="https://en.wikipedia.org/wiki/Pandora" target="blank"><img src="https://scontent.ftlv5-1.fna.fbcdn.net/v/t1.18169-9/179609_492473770810335_233997892_n.jpg?_nc_cat=102&ccb=1-5&_nc_sid=cdbe9c&_nc_ohc=he4zXYw2UdoAX9EviCJ&_nc_ht=scontent.ftlv5-1.fna&oh=463b5640a4781c5c13583791fab8d2a5&oe=61A967A1" width="300" alt="Pandora" /></a>
</p>

<p align="center">
  <a href="https://github.com/LagunaHealth/pandora/actions?query=branch%3Amaster">
    <img src="https://github.com/LagunaHealth/pandora/workflows/Pandora/badge.svg" alt="Develop ci/cd status." />
  </a>
  <a href="https://github.com/LagunaHealth/pandora/contributors" alt="Contributors">
    <img src="https://img.shields.io/github/contributors/badges/shields" />
  </a> <br/>
  <b>Total coverage:</b>
  <a href="https://laguna-health-coverage.s3.amazonaws.com/pandora/master/lcov-report/index.html" alt="lines">
    <img src="https://laguna-health-coverage.s3.amazonaws.com/pandora/master/badge-lines.svg?branch=master" />
  </a>
  <b>Other coverage:</b>
  <a href="https://laguna-health-coverage.s3.amazonaws.com/pandora/master/lcov-report/index.html" alt="functions">
    <img src="https://laguna-health-coverage.s3.amazonaws.com/pandora/master/badge-functions.svg?branch=master" />
  </a>
  <a href="https://laguna-health-coverage.s3.amazonaws.com/pandora/master/lcov-report/index.html" alt="statements">
    <img src="https://laguna-health-coverage.s3.amazonaws.com/pandora/master/badge-statements.svg?branch=master" />
  </a>
</p>

# 📨 Pandora

Laguna health shared component for interfaces of sending/receiving a message.
<br/>Written in typescript

- [📨 Pandora](#-pandora)
  - [💡 Project introduction](#-project-introduction)
  - [📋 Prerequisites](#-prerequisites)
    - [Installation](#installation)
    - [Aws](#aws)
    - [Shared code settings](#shared-code-settings)
  - [🏠 Working locally](#-working-locally)

## 💡 Project introduction

This project handles all shared data, interfaces and logic for sending data to [iris](https://github.com/LagunaHealth/iris)

## 📋 Prerequisites

### Installation

install all dependencies in [package.json](./package.json) file by running the following command:

```bash
$ yarn
```

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

## 🏠 Working locally

When working locally we would like to be able to test our changes in `Hepius` and `Iris`.

For that reason we create a snapshot for every commit you make on a _Pull Request_, this snapshot consists of the current version of pandora with that hash of the commit.

you can find the snapshot version that was created in the _Pull Request_ page as a comment with the coverage. Simply paste the snapshot version in the `package.json` of the project you want to test

```json
  .
  .
  },
  "dependencies": {
    "@lagunahealth/pandora": "[the version commented on the PR]",
  .
  .
```

and run `$ yarn` to install the snapshot package.
