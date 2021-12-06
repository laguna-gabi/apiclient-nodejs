import { Injectable, ValidationPipe } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import { Test, TestingModule } from '@nestjs/testing';
import { createTestClient } from 'apollo-server-testing';
import { BaseHandler } from '../test';
import { AppModule } from '../src/app.module';
import { UserService } from '../src/user';
import { Mutations, Queries } from '../test/aux';

@Injectable()
export class SeedBase extends BaseHandler {
  async init() {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    this.app = moduleFixture.createNestApplication();
    this.app.useGlobalPipes(new ValidationPipe());
    await this.app.init();

    this.module = moduleFixture.get<GraphQLModule>(GraphQLModule);

    const apolloServer = createTestClient((this.module as any).apolloServer);
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
