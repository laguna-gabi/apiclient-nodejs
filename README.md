# Hepius
Laguna health backend infrastructure

## Description

Written in typescript by using [Nest](https://github.com/nestjs/nest) framework TypeScript starter repository.

## Installation

```bash
$ yarn
```

### Docker
We're loading a local mongodb by using [docker](https://docs.docker.com/get-docker/).
1. [docker](https://docs.docker.com/get-docker/).
2. run `docker-compose.yml` file for starting Docker, by using the command: `docker-compose up`.
> **_Stop:_**  After running the sample, you can stop the Docker container with `docker-compose down`

## Running the app

```bash
# development
$ yarn start

# watch mode
$ yarn start:dev

# production mode
$ yarn start:prod
```

## Test

```bash
# unit tests
$ yarn test

# integration tests
$ yarn test:integration

# test coverage
$ yarn test:cov
```

## How to view and work with Graphql's methods
In order to figure out what's the endpoints of *hepius*:
1. init and load local mongodb as described on [docker section](#docker)
2. run yarn start
3. go to [graphql playground](http://localhost:3000/graphql) and create queries and mutations according to the docs.
> **_Seed data_** If you wish to generate initial member and users, run `yarn seed`

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