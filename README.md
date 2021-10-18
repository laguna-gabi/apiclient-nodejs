# Hepius

Laguna health backend infrastructure.
<br/>Written in typescript by using [Nest](https://github.com/nestjs/nest) framework.

- [Hepius](#hepius)
  - [Project introduction](#project-introduction)
    - [entities](#entities)
  - [Prerequisites](#prerequisites)
    - [Installation](#installation)
    - [Docker](#docker)
    - [Aws](#aws)
    - [Shared code settings](#shared-code-settings)
  - [Running the app](#running-the-app)
  - [Testing the app](#testing-the-app)
  - [Using the API](#using-the-api)
    - [REST](#rest)
    - [GraphQL](#graphql)
  - [Role Based Access Control: RBAC](#role-based-access-control-rbac)
    - [Access token snippet](#token-snippet)
  - [Troubleshooting](#troubleshooting)
    - [How to view the db locally?](#how-to-view-the-db-locally)
    - [Error at connection to mongo locally](#error-at-connection-to-mongo-locally)
- [Appendix](#appendix)
  - [jwt.io token generation](#jwtio-token-generation)
  - [GraphQL Playground](#graphql-playground)

<br/><br/>

## Project introduction

This project handles all the backend logic for laguna-health.

- We're using mongodb in order to store our data.
- We're using graphql for the secure methods.
- We're using rest for the unsecure methods (minimal number of methods)

### entities

The main entities in our system:

1. <b>User</b>: internal laguna employees: coaches, nurse, dr, etc
2. <b>Org</b>: a member's associated org : hospital, health insurance, etc...
3. <b>Member</b>: a patient using web or mobile(preferable)
   <br/> Each member has an `primaryUserId` which is his main coach.
   <br/> Each member has an `orgId` which is his associated org
4. <b>Appointment</b>: a schedule appointment between a member and a user.
5. <b>Availabilities</b>: a user's time availabilities (for example, `start: 10/02/2022 10:00:00 end: 10/02/2022 12:00:00`)

## Prerequisites

### Installation

install all dependencies in [package.json](./package.json) file by running the following command:

```bash
$ yarn
```

### Docker

We're loading a local mongodb by using [docker](https://hub.docker.com/).

1. install [docker](https://docs.docker.com/get-docker/).
2. run `docker-compose up -d` for [starting docker](./docker-compose.yml) with 2 mongodb instances(localhost and test).
   > **_Stop:_** After running the sample, you can stop the Docker container with `docker-compose down` > <br/><br/>

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

## Running the app

In order to work with all graphql endpoints of _hepius_:

1. init and load local mongodb as described on [docker section](#docker)
2. start the server by using one of the following methods:
   <br/>2a. run `yarn start` if you just want to use _hepius_ api locally
   <br/>2b. run `yarn start:dev` if you're creating code changes in _hepius_ and you wish to load the local changes automatically
3. run `yarn seed` : generates initial org, users, members and appointments on you local station
4. go to [graphql playground](http://localhost:3000/graphql) and create queries and mutations according to the docs.

## Testing the app

```bash
# unit tests
$ yarn test

# integration tests
$ yarn test:integration

# test coverage
$ yarn test:cov
```

## Using the API

Hepius is serving endpoints via REST (controller handlers) as well as GraphQL (resolvers).

Role based access control is implemented so a (Bearer) token carrying a valid 'authId'
claim should be provided in the Authorization header.

The 'authId' can be found in all user and member entities (mongoDb) - every provisioned member
and user should have a unique authId.

When running on localhost we can generate a token (does not have to be signed and valid) in the jwt.io debugger - see [jwt.io-token generation](#appendix)

### REST

Example (GET request to get slots for an appointment):

```
curl --location --request GET 'localhost:3000/api/users/slots/61682dab90669d1f1297caad' \
--header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2MTY2ZTliMDBjMjFjNzdlY2ZiYzEwNzMiLCJuYW1lIjoiSm9obiBEb2UiLCJpYXQiOjE1MTYyMzkwMjJ9._9zqXpkuffqbXA1IJ0kp9gp0YYyvb4BMo2mQ5qOLh6E' \
--header 'Content-Type: application/json'
```

### GraphQL

To send GraphQL resolvers / mutation requests you need to use the GQL Playgroud - you should make sure to update the headers to include a valid token - see [appendix](#graphql-playground).
<br/><br/>

## Role Based Access Control: RBAC

- A route (GQL or REST) is protected if not marked as 'IsPublic' - only users with admin priviliges
- Routes can be annotated with the 'Roles' annotation to include 1 or more allowed roles.
- If a route is allowed for role1 (example) amd role2 has a higher weight in hierarchy it will be allowed for users with role2 (Example: 'User' role can be allowed where 'Member' role is allowed).

The role hierarchy can be found in [here](src/auth/roles.ts):

```
export const SystemRoles = {
  User: { isAdmin: true, weight: 100 },
  Member: { isAdmin: false, weight: 10 },
  Anonymous: { isAdmin: false, weight: 1 },
};
```

more details can be found [here](https://app.shortcut.com/laguna-health/story/1852/define-role-base-access-to-all-secure-apis).

When adding a new route or
Current implementation

## Token snippet

Because of the RBAC we are forced to provide an access token for most of the api requests. To work locally fast we could use the same token by updating user's `authId` instead of updating the token everywhere.

Start by going to the database and change one of the user's `authId` to `"admin"` after that all we need to do is add the following line to the HTTP HEADERS in the Graphql playground.

```json
{
  "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhZG1pbiIsIm5hbWUiOiJKb2huIERvZSIsImlhdCI6MTUxNjIzOTAyMn0.a4ZLo2TxNUb8mj4ff9z9v1IE3PlSPpFuLCT45ljOVUI"
}
```

## Troubleshooting

### How to view the db locally?

1. Download and install [robomongo](https://robomongo.org/download) or any other mongodb visualizer you like
2. Set up local connection to : `mongodb://localhost:27017/laguna`, as defined on [db.module.ts](./src/db/db.module.ts)
   ! there's no need for authentication when connecting locally to mongodb

### Error at connection to mongo locally

```text
[MongooseModule] Unable to connect to the database. Retrying (1)
connect ECONNREFUSED 127.0.0.1:27017
```

An instance of mongo is not running locally, go over [docker section](#docker) again.

# Appendix

## jwt.io token generation

[link to jwt.io](https://jwt.io/)
![alt text](./assets/jwt.io.png)

## GraphQL Playground

[link to a local GQL](http://localhost:3000/graphql)
![alt text](./assets/graphql.png)
