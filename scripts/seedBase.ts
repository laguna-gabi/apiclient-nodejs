import { Injectable, ValidationPipe } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import { Test, TestingModule } from '@nestjs/testing';
import { createTestClient } from 'apollo-server-testing';
import { QuestionnaireService } from '../src/questionnaire';
import { AppModule } from '../src/app.module';
import { QueueService } from '../src/providers';
import { UserService } from '../src/user';
import { BaseHandler } from '../test';
import { Mutations, Queries } from '../test/aux';

@Injectable()
export class SeedBase extends BaseHandler {
  queueService: QueueService;
  questionnaireService: QuestionnaireService;

  async init() {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    this.app = moduleFixture.createNestApplication();
    this.app.useGlobalPipes(new ValidationPipe());
    await this.app.init();

    this.module = moduleFixture.get<GraphQLModule>(GraphQLModule);
    this.queueService = moduleFixture.get<QueueService>(QueueService);

    const apolloServer = createTestClient(this.module.apolloServer);
    this.mutations = new Mutations(apolloServer);
    this.queries = new Queries(apolloServer);
    this.userService = moduleFixture.get<UserService>(UserService);
    this.questionnaireService = moduleFixture.get<QuestionnaireService>(QuestionnaireService);
  }

  async cleanUp() {
    /**
     * Since we have an eventEmitter updating db, we need to postpone closing the
     * db until after the update occurs.
     * @see [UserService#handleOrderCreatedEvent]
     */
    await new Promise((f) => setTimeout(f, 100));
    await this.app.close();
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    await this.queueService.consumer.stop();
  }
}
