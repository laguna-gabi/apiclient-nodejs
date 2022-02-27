import { Injectable, ValidationPipe } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GraphQLModule } from '@nestjs/graphql';
import { Test, TestingModule } from '@nestjs/testing';
import { datatype } from 'faker';
import { GraphQLClient } from 'graphql-request';
import { AppModule } from '../src/app.module';
import { GlobalAuthGuard, RolesGuard } from '../src/auth';
import { UserRole } from '../src/common';
import { QueueService } from '../src/providers';
import { QuestionnaireService } from '../src/questionnaire';
import { UserService } from '../src/user';
import { BaseHandler } from '../test';
import { Mutations, Queries, initClients } from '../test/aux';

@Injectable()
export class SeedBase extends BaseHandler {
  queueService: QueueService;
  questionnaireService: QuestionnaireService;
  client: GraphQLClient;

  async init() {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    this.app = moduleFixture.createNestApplication();
    this.app.useGlobalPipes(new ValidationPipe());

    const reflector = this.app.get(Reflector);
    this.app.useGlobalGuards(new GlobalAuthGuard());
    this.app.useGlobalGuards(new RolesGuard(reflector));

    await this.app.init();

    this.module = moduleFixture.get<GraphQLModule>(GraphQLModule);
    this.queueService = moduleFixture.get<QueueService>(QueueService);
    this.userService = moduleFixture.get<UserService>(UserService);
    this.questionnaireService = moduleFixture.get<QuestionnaireService>(QuestionnaireService);

    await this.app.listen(datatype.number({ min: 4000, max: 9000 }));
    this.client = new GraphQLClient(`${await this.app.getUrl()}/graphql`);

    const defaultUserRequestHeaders = await initClients(this.userService, [
      UserRole.nurse,
      UserRole.coach,
    ]);
    const defaultAdminRequestHeaders = await initClients(this.userService, [UserRole.admin]);

    this.mutations = new Mutations(
      this.client,
      defaultUserRequestHeaders,
      defaultAdminRequestHeaders,
    );
    this.queries = new Queries(this.client, defaultUserRequestHeaders);
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
