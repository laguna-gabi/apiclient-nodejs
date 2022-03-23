<p align="center">
  <a href="https://en.wikipedia.org/wiki/Iris_(mythology)" target="blank">
     <img src="https://upload.wikimedia.org/wikipedia/commons/a/aa/Winged_goddess_Cdm_Paris_392.jpg" 
     height="250" 
     alt="Iris" />
  </a><br/>
  <b>Total coverage:</b>
  <a href="https://laguna-health-coverage.s3.amazonaws.com/iris/develop/lcov-report/index.html" alt="lines">
    <img src="https://laguna-health-coverage.s3.amazonaws.com/iris/develop/badge-lines.svg?branch=develop" />
  </a>
  <b>Other coverage:</b>
  <a href="https://laguna-health-coverage.s3.amazonaws.com/iris/develop/lcov-report/index.html" alt="functions">
    <img src="https://laguna-health-coverage.s3.amazonaws.com/iris/develop/badge-functions.svg?branch=develop" />
  </a>
  <a href="https://laguna-health-coverage.s3.amazonaws.com/iris/develop/lcov-report/index.html" alt="statements">
    <img src="https://laguna-health-coverage.s3.amazonaws.com/iris/develop/badge-statements.svg?branch=develop" />
  </a>
</p>

# 📨 Iris

Laguna health messages component.
<br/>Written in typescript by using [Nest](https://github.com/nestjs/nest) framework.

- [📨 Iris](#-iris)
  - [💡 Project introduction](#-project-introduction)
    - [entities](#entities)
  - [🚀 Running the app](#-running-the-app)
  - [API](#api)

## 💡 Project introduction

This project handles all the messages' logic for laguna-health.
<br/>**All** messages to members, users, etc.. will be sent from this component.

- We're using mongodb (with [replica set](https://docs.mongodb.com/manual/replication/)) in order to store our data.
- We're using aws sqs in order to receive messages from Laguna Health services.

### entities

The main entities in our system:

## 🚀 Running the app

In order to work with _iris_:

1. init and load local mongodb as described on [docker section](#docker)
2. start the server by using one of the following methods:
   run `yarn start:watch` if you just want to use _iris_ locally

## API

`Iris` is exposing an internal API (service.2.service) and Swagger documentation is attached.. try it out in:

```
${hostname}:3001/api
```
