<p align="center">
  <a href="https://en.wikipedia.org/wiki/Asclepius" target="blank">
    <img src="https://upload.wikimedia.org/wikipedia/commons/9/98/Asklepios_-_Epidauros.jpg" 
      height="200" 
      alt="Hepius" />
  </a><br/>
  <b>Total coverage:</b>
  <a href="" alt="lines">
    <img src="https://laguna-health-coverage.s3.amazonaws.com/hepius/badge-lines.svg?branch=develop&kill_cache=1" />
  </a>
  <b>Other coverage:</b>
  <a href="" alt="functions">
    <img src="https://laguna-health-coverage.s3.amazonaws.com/hepius/badge-functions.svg?branch=develop&kill_cache=1" />
  </a>
  <a href="" alt="statements">
    <img src="https://laguna-health-coverage.s3.amazonaws.com/hepius/badge-statements.svg?branch=develop&kill_cache=1" />
  </a>
</p>

# 🏥 Hepius

Laguna health backend infrastructure.
<br/>Written in typescript by using [Nest](https://github.com/nestjs/nest) framework.

- [🏥 Hepius](#-hepius)
  - [💡 Project introduction](#-project-introduction)
    - [entities](#entities)
  - [👨‍💻 Using the API](#-using-the-api)
    - [REST](#rest)
    - [GraphQL](#graphql)
  - [🚫 Role Based Access Control: RBAC](#-role-based-access-control-rbac)
  - [🔑 Token Generating](#-token-generating)
  - [⛽️ Utility Scripts/Commands](#️-utility-scriptscommands)
    - [Application Seed:](#application-seed)
    - [Create user:](#create-user)
    - [Create Token:](#create-token)
    - [Laguna Seed:](#laguna-seed)
    - [Set up the DB:](#set-up-the-db)
  - [🏗️ Analytics](#️-analytics)
    - [Uploading a new version to EC2 auto loader](#uploading-a-new-version-to-ec2-auto-loader)
  - [🏗️ Migration](#️-migration)
    - [Overview](#overview)
    - [What's new in our latest release?](#whats-new-in-our-latest-release)
    - [Migration Support: guide](#migration-support-guide)
- [✂️ Appendix](#️-appendix)
  - [jwt.io token generation](#jwtio-token-generation)
  - [GraphQL Playground](#graphql-playground)

## 💡 Project introduction

This project handles all the backend logic for laguna-health.

- We're using mongodb in order to store our data.
- We're using graphql for the secure methods.
- We're using rest for the unsecure methods (minimal number of methods)

### entities

The main entities in our system:

1. <b>Member</b>: The main entity the member is our app/web patient this entity holds most member data such as: first name, last name, phone number, etc.
2. <b>Memberconfig</b>: The member config is the configuration of the member, holds tokens, settings and other internal information.
3. <b>Controlmember</b>: The control member holds our control members used for statistics.
4. <b>User</b>: The user entity holds our coaches, nurses and system admins entities.
5. <b>Userconfig</b>: The user config holds the configurations of the user, holds a token.
6. <b>Appointment</b>: The appointments between member and user.
7. <b>Availabilities</b>: The users time availabilities.
8. <b>Careplans</b>: Holds the members carePlan also connected to barriers and redflags entities.
9. <b>Communications</b>: Communications between member and user holds the chat data.
10. <b>Orgs</b>: Member and Users are associated with an Org.
11. <b>Todos</b>: Members Todos could be created by member or user, also there are action todos that move the member to diffrent features in the apps.

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

## ⛽️ Utility Scripts/Commands

Seed and other support scripts will run via the `command` target of `hepius`

### Application Seed:

```
nx command hepius --cmd=general --options='-t seed'
```

### Create user:

```
nx command hepius --cmd=general --options='-t createUser'
```

### Create Token:

```
nx command hepius --cmd=general --options='-t getTokens'
```

### Laguna Seed:

```
nx command hepius --cmd=general --options='-t lagunaSeed'
```

### Set up the DB:
sets up the docker, runs seed and generated tokens  

```
yarn setup
```

## 🏗️ Analytics

Running analytics will generate output csv files for analytics team - here's how to generate all csv files (members, coach and appointments data)

```
nx command hepius --cmd=analytics'
```

OR 
```
yarn analytics:dump:<env>
```

### Uploading a new version to EC2 auto loader
1. in AWS console navigate to the EC2 machine list 
2. select the `Data Analytics` machine and `connect` to it (via console)
3. switch to `ec2-user` , cd to the auto loader directory and pull latest version and run it
```
su - ec2-user
cd Projects/DataAnalytics/argus
git pull
yarn analytics:dump:prod
```

**Note**: after you run the command once it will generate a main.js in dist which will be used for the nightly runs.. 

## 🏗️ Migration

### Overview

---

Changes to the application may require db changes (adding new mandatory fields, adding pre-calculated fields, updating field values, etc...).
It is important to include those required/applied changes as part of our code base to achieve transparency during code reviews and to be able to roll back changes if needed.

The current support is now a proprietary TS based [Nest commander](https://docs.nestjs.com/recipes/nest-commander) inside our `Hepius` package.

The migration status is persisted to our mongo db - `changelog` collection. **Manipulating of that collection may affect the migration status** and as a result the applied migration scripts when running the migration's `up` and `down` commands.

The migration is applied automatically in our ci-cd when merging our code to `develop` or `stage` branches - migration job depends on a successful `deploy` job.

Migration is supported via `Argus` ci/cd manual flow under the same restrictions mention above.

---

### What's new in our latest release?

- Proprietary fully customizable (.ts) migration CLI and service support (now supporting only `.ts` extension files)
- Force `up` and `down` for specific migration files (out-of-order and force for non `PENDING` migration files)
- Dry Run flag for `up` and `down` commands - **note**: dry run mode will not update `changelog` collection

---

### Migration Support: guide

---

- **Step 0**: get help...
  ```
  nx command hepius --cmd=migration --options='-h'
  ```
- **Step 1**: create a new migration script (template):

  ```
  nx command hepius --cmd=migration --options='create <script-description>'
  ```

  A new migration script is created in the [migrations](./cmd/migration/scripts) directory with the following format:

  ```
  <yyyyMMddHHmmss>-<script-description>
  ```

  Example: `20220102085546-my-first-migration.ts`

  The migration `index.ts` file inside the `scripts` directory will get updated to include the new file along with a unique (timestamp based) descriptor.

  **! DO NOT RENAME THE FILE !**

  **! MAKE SURE TO STAGE ALL CHANGES INCLUDING INDEX FILE !**

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
  nx command hepius --cmd=migration --options='status'
  ```

  | Filename                               | Applied At               |
  | -------------------------------------- | ------------------------ |
  | 20211125153552-set-member-roles.ts     | 2021-11-27T09:27:54.171Z |
  | 20211127092801-update-member-config.ts | PENDING                  |

- **Step 3.1**: test the code on your local mongo db - apply your new migration script:
  ```
  nx command hepius --cmd=migration --option='up [<file-name>] [-d]'
  ```
  (file name and -d for dry run are optional)
  Note: name field is optional and you can add a specific migration file to migrate `up` (could be out of order and not necessarily `PENDING`)
- **Step 3.2**: undo changes - test your `down` code on your local mongo db:

  ```
  nx command hepius --cmd=migration --options='down <file-name> [-d]'
  ```

  ***

- **Step 4**: commit your changes - you need to commit your newly created migration script and auto changes made to the index file.

# ✂️ Appendix

## jwt.io token generation

[link to jwt.io](https://jwt.io/)
![alt text](./assets/jwt.io.png)

## GraphQL Playground

[link to a local GQL](http://localhost:3000/graphql)
![alt text](./assets/graphql.png)
