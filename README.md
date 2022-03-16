<p align="center">
  <a href="https://github.com/LagunaHealth/hepius/actions?query=branch%3Adevelop">
    <img src="https://github.com/LagunaHealth/hepius/workflows/Laguna/badge.svg" alt="Develop ci/cd status." />
  </a>
  <a href="https://github.com/LagunaHealth/hepius/contributors" alt="Contributors">
    <img src="https://img.shields.io/github/contributors/badges/shields" />
  </a> <br/>
  <b>Total coverage:</b>
  <a href="https://laguna-health-coverage.s3.amazonaws.com/hepius/develop/lcov-report/index.html" alt="lines">
    <img src="https://laguna-health-coverage.s3.amazonaws.com/hepius/develop/badge-lines.svg?branch=develop" />
  </a>
  <b>Other coverage:</b>
  <a href="https://laguna-health-coverage.s3.amazonaws.com/hepius/develop/lcov-report/index.html" alt="functions">
    <img src="https://laguna-health-coverage.s3.amazonaws.com/hepius/develop/badge-functions.svg?branch=develop" />
  </a>
  <a href="https://laguna-health-coverage.s3.amazonaws.com/hepius/develop/lcov-report/index.html" alt="statements">
    <img src="https://laguna-health-coverage.s3.amazonaws.com/hepius/develop/badge-statements.svg?branch=develop" />
  </a><br/>
  <a href="https://en.wikipedia.org/wiki/Asclepius" target="blank">
      <img src="https://upload.wikimedia.org/wikipedia/commons/9/98/Asklepios_-_Epidauros.jpg" 
       height="200" 
       alt="Hepius" />
  </a>
</p>

# 🏥 Hepius

Laguna health backend infrastructure.
<br/>Written in typescript by using [Nest](https://github.com/nestjs/nest) framework.

- [🏥 Hepius](#-hepius)
  - [💡 Project introduction](#-project-introduction)
    - [entities](#entities)
  - [📋 Prerequisites](#-prerequisites)
    - [Installation](#installation)
    - [Docker](#docker)
    - [Aws](#aws)
    - [Shared private library - Pandora](#shared-private-library---pandora)
    - [Shared code settings](#shared-code-settings)
  - [🚀 Running the app](#-running-the-app)
  - [🧪 Testing the app](#-testing-the-app)
  - [👨‍💻 Using the API](#-using-the-api)
    - [REST](#rest)
    - [GraphQL](#graphql)
  - [🚫 Role Based Access Control: RBAC](#-role-based-access-control-rbac)
  - [🔑 Token Generating](#-token-generating)
  - [🏗️ Migration](#️-migration)
    - [Overview](#overview)
    - [What's new in our latest release?](#whats-new-in-our-latest-release)
    - [Migration Support: guide](#migration-support-guide)
  - [🎻 Troubleshooting](#-troubleshooting)
    - [How to view the db locally?](#how-to-view-the-db-locally)
    - [Error at connection to mongo locally](#error-at-connection-to-mongo-locally)
- [✂️ Appendix](#️-appendix)
  - [jwt.io token generation](#jwtio-token-generation)
  - [GraphQL Playground](#graphql-playground)
  - [Github generate developer token](#github-generate-developer-token)

## 💡 Project introduction

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

## 📋 Prerequisites

### Installation

install all dependencies in [package.json](./package.json) file by running the following command:

```bash
$ yarn
```

### Docker

We're loading a local mongodb by using [docker](https://hub.docker.com/).

1. install [docker](https://docs.docker.com/get-docker/).
2. run `docker-compose up -d` for [starting docker](./docker-compose.yml) with 2 mongodb instances(localhost and test) and an instance of localstack.
   > **_Stop:_** After running the sample, you can stop the Docker container with `docker-compose down`<br/>
3. run `yarn:localstack` to initialize the local _sqs_ and _s3_.
   > after each queue creation there will be a pop up, just press `Q` on the keyboard.

### Aws

In order to work locally with aws cli and `package.json` dependencies, install

1. install [aws cli](https://docs.aws.amazon.com/cli/latest/userguide/install-cliv2-mac.html) (will be easy for working with aws on terminal)
2. [set up](https://docs.aws.amazon.com/sdk-for-java/v1/developer-guide/setup-credentials.html) credentials on your local computer (make sure to set region to `us-east-1`)
   > **_Don't skip aws setup:_** This step is critical to develop locally on this project.
   > We're loading configurations(api keys and tokens for external providers such as
   > [sendbird](https://sendbird.com), [onesignal](https://onesignal.com), [twilio](https://www.twilio.com), etc...)
   > from [aws secrets manager](https://aws.amazon.com/secrets-manager/).

### Shared private library - Pandora

We have a Laguna shared library called [Pandora](https://github.com/LagunaHealth/pandora), which is an interface for sending messages.
<br/>This package is installed when running `yarn install`, and since it is private, each developer needs to create his/her own
[github access token](https://github.com/settings/tokens/new), so pulling this library will be possible.

> **_Don't skip library setup:_** This step is critical to develop locally on this project.

1. Create a personal access token
   1. go to [github - generate new developer tokens](https://github.com/settings/tokens/new)
   2. select `repo` - all and `write:package`. In the end it should look like [this](#github-generate-developer-token).
   3. in the bottom press `Generate token`
   4. copy the token which was generated (you won't be able to update it or see it when you re-open the page)
2. Login to npm/yarn private repository in order to fetch [pandora npm package](https://github.com/LagunaHealth/pandora/packages/1084197)
   ```
    npm login --registry=https://npm.pkg.github.com
    Username: GitHub-username
    Password: your-github-access-token-from-previous-step
    Email: (this IS public) your-email@example.com
    Logged in as XXXX on https://npm.pkg.github.com/.
   ```
   > You have to see the `Logged in as XXXX on https://npm.pkg.github.com/`, or otherwise `yarn install` won't work.

In the end of this process, you need to have a `~/.npmrc` file (located in the root of your computer), having 1 field:

```bash
//npm.pkg.github.com/:_authToken=your-github-access-token-from-previous-step
```

That's it, you can run `yarn` now, and it'll install the pandora private library as well.

### Shared code settings

1. Set up your ide to run with `.prettierrc` file which exists on the main root of the project.
2. Set up your ide to run with `.eslintrc.js` file which exists on the main root of the project.

## 🚀 Running the app

In order to work with all graphql endpoints of _hepius_:

1. init and load local mongodb as described on [docker section](#docker)
2. start the server by using one of the following methods:
   <br/>2a. run `yarn start` if you just want to use _hepius_ api locally
   <br/>2b. run `yarn start:dev` if you're creating code changes in _hepius_ and you wish to load the local changes automatically
3. run `yarn seed` : generates initial org, users, members and appointments on you local station
4. go to [graphql playground](http://localhost:3000/graphql) and create queries and mutations according to the docs.

## 🧪 Testing the app

```bash
# unit tests
$ yarn test

# validation tests
$ yarn test:validation

# integration tests
$ yarn test:integration
```

## 👨‍💻 Using the API

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

## 🚫 Role Based Access Control: RBAC

- A route (GQL or REST) is protected if not marked as 'IsPublic' - only users with admin privileges can access it
- Routes can be annotated with the 'Roles' annotation to include 1 or more allowed roles.
- "admin" can access ALL routes (implicitly), otherwise only explicitly annotated roles determine the access (if annotated role(s) included in user roles)
- Note: "admin" type users who are not provisioned as "coach" will not be assigned members and will not be available for members (schedule an appointment)

more details can be found [here](https://app.shortcut.com/laguna-health/story/1852/define-role-base-access-to-all-secure-apis).

When adding a new route or
Current implementation

## 🔑 Token Generating

Because of the RBAC and the use of the token sub instead of member/user id, we are forced to provide an access token for most of the api requests. To work locally fast we can generate access tokens for all our users and members and then just add them to the headers.

use the following command to generate tokens:

```bash
# local environment
yarn generate:tokens

# develop environment
yarn generate:tokens:dev

# production environment
yarn generate:tokens:production
```

## 🏗️ Migration

### Overview

---

Changes to the application may require db changes (adding new mandatory fields, adding per-calculated fields, updating field values, etc...).
It is important to include those required/applied changes as part of our code base to allow for code reviews and to be able to roll back changes if needed.

The current support is now a proprietary [Nest commander](https://docs.nestjs.com/recipes/nest-commander) based TS internal Hepius package.

The migration status is persisted to our mongo db - `changelog` collection. **Manipulating of that collection may affect the migration status** and as a result the applied migration scripts when running the migration `up` and `down` commands.

The migration is applied automatically in our ci-cd when merging our code to `develop` or `stage` branches - migration will run after the test/coverage job.

---

### What's new in our latest release?

- Proprietary fully customizable (.ts) migration CLI and service support (now supporting only `.ts` extension files)
- Force `up` and `down` for specific migration files (out-of-order and force for non `PENDING` migration files)
- Dry Run flag for `up` and `down` commands - **note**: dry run mode will not update `changelog` collection
- Removed the `init` command - not needed anymore..

---

### Migration Support: guide

---

- **Step 1**: create a new migration script (template):

  ```
  yarn migrate create <script-description>
  ```

  A new migration script is created in the [migrations](./cmd/migration/scripts) directory with the following format:

  ```
  <yyyyMMddHHmmss>-<script-description>
  ```

  Example: `20220102085546-my-first-migration.ts`

  **! DO NOT RENAME THE FILE !**

  ***

- **Step 2**: add your changes to the newly created migration script - `up` and `down` code is required

  Example:

  ```
  export const up = async (dryRun: boolean, db: Db) => {
    console.info(InfoColoring, `(${path.basename(__filename)}) migrating ${Command.up}`);
    if (dryRun) {
      // Note! if dry-run mode is applied the changelog will NOT get updated.
      console.info(InfoColoring, 'dry-run mode');
    }

    db.collection('members')
      .find()
      .forEach((member) => {
        console.log(`member ${member.honorific} ${member.lastName} is part of the Laguna db`);
        db.collection('users').findOneAndUpdate(
          { memberId: new Types.ObjectId(member.id) },
          { $push: { members: member.id } },
        );
      });
  }
  ```

  **Note**: a mongo client is supplied to the `up` and `down` methods upon invocation and so it matches the behavior of the preview migration support we had.. however, the generated file can be customized to upload the entire Hepius app module via the Nest Factory context creation and the provide access to any available service or model - for example:

  ***

  ```
    const app = await NestFactory.createApplicationContext(AppModule);

    // get the Member model from the Nest factory
    const memberModel = app.get<Model<Member>>(getModelToken(Member.name));

    const members = await memberModel.find({});

    members.forEach((member) => {
      console.log(`member ${member.honorific} ${member.lastName} is part of the Laguna db`);
      db.collection('users').findOneAndUpdate(
        { memberId: new Types.ObjectId(member.id) },
        { $push: { members: member.id } },
      );
    });
  ```

  ***

- **Step 3.1**: test the code on your local mongo db - first you check the status in your local db - the results is a list of migrations applied on your local db and pending migrations which should get applied - migration is not applied in `status` command - DRY-RUN mode:

  ```
  yarn migrate status
  ```

  | Filename                               | Applied At               |
  | -------------------------------------- | ------------------------ |
  | 20211125153552-set-member-roles.ts     | 2021-11-27T09:27:54.171Z |
  | 20211127092801-update-member-config.ts | PENDING                  |

- **Step 3.1**: test the code on your local mongo db - apply your new migration script:
  ```
  yarn migrate up [name] [-d for optional dry run mode ]
  ```
  Note: name field is optional and you can add a specific migration file to migrate `up` (could be out of order and not necessarily `PENDING`)
- **Step 3.2**: undo changes - test your `down` code on your local mongo db:

  ```
  yarn migrate down [name] [-d for optional dry run mode ]
  ```

  ***

- **Step 4**: commit your changes - you only need to commit your newly created migration script.

## 🎻 Troubleshooting

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

# ✂️ Appendix

## jwt.io token generation

[link to jwt.io](https://jwt.io/)
![alt text](./assets/jwt.io.png)

## GraphQL Playground

[link to a local GQL](http://localhost:3000/graphql)
![alt text](./assets/graphql.png)

## Github generate developer token

![alt text](./assets/githubAccessToken.png)
