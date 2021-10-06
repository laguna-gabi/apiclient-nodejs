import { INestApplication, Injectable, ValidationPipe } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import { Test, TestingModule } from '@nestjs/testing';
import { createTestClient } from 'apollo-server-testing';
import { AppModule } from '../src/app.module';
import { UserService } from '../src/user';
import { Mutations } from '../test/aux/mutations';
import { Queries } from '../test/aux/queries';

@Injectable()
export class SeedBase {
  mutations: Mutations;
  queries: Queries;
  userService: UserService; //used for internal method, isn't exposed on queries
  app: INestApplication;
  
  async init() {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    this.app = moduleFixture.createNestApplication();
    this.app.useGlobalPipes(new ValidationPipe());
    await this.app.init();

    const module: GraphQLModule = moduleFixture.get<GraphQLModule>(GraphQLModule);

    const apolloServer = createTestClient((module as any).apolloServer);
    this.mutations = new Mutations(apolloServer);
    this.queries = new Queries(apolloServer);
    this.userService = moduleFixture.get<UserService>(UserService);
  }

  async cleanUp() {
    /**
     * Since we have an eventEmitter updating db, we need to postpone closing the
     * db until after the update occurs.
     * @see [UserService#handleOrderCreatedEvent]
     */
    await new Promise((f) => setTimeout(f, 100));
    await this.app.close();
  }
}
