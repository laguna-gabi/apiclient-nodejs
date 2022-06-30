import { User, UserRole } from '@argus/hepiusClient';
import {
  AppRequestContext,
  Environments,
  TcpAuthInterceptor,
  requestContextMiddleware,
} from '@argus/pandora';
import { Injectable, ValidationPipe } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { GraphQLModule } from '@nestjs/graphql';
import { Test, TestingModule } from '@nestjs/testing';
import { GraphQLClient } from 'graphql-request';
import { AppModule } from '../src/app.module';
import { GlobalAuthGuard, RolesGuard } from '../src/auth';
import { QueueService } from '../src/providers';
import { QuestionnaireService } from '../src/questionnaire';
import { UserResolver, UserService } from '../src/user';
import { BaseHandler, generateRandomPort } from '../test';
import { Mutations, Queries, initClients } from '../test/aux';
import { Model } from 'mongoose';
import { getModelToken } from '@nestjs/mongoose';

@Injectable()
export class SeedBase extends BaseHandler {
  queueService: QueueService;
  questionnaireService: QuestionnaireService;
  client: GraphQLClient;

  async init(force = false) {
    if (process.env.NODE_ENV === Environments.production && !force) {
      throw new Error(`running seed on ${process.env.NODE_ENV} environment is not allowed!`);
    }
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    this.app = moduleFixture.createNestApplication();
    this.app.useGlobalPipes(new ValidationPipe());

    const reflector = this.app.get(Reflector);
    this.app.useGlobalGuards(new GlobalAuthGuard());
    this.app.useGlobalGuards(new RolesGuard(reflector));
    this.app.use(requestContextMiddleware(AppRequestContext));

    this.app.useGlobalInterceptors(new TcpAuthInterceptor());

    await this.app.init();

    this.module = moduleFixture.get<GraphQLModule>(GraphQLModule);
    this.eventEmitter = moduleFixture.get<EventEmitter2>(EventEmitter2);
    this.queueService = moduleFixture.get<QueueService>(QueueService);
    this.userModel = moduleFixture.get<Model<User>>(getModelToken(User.name));
    this.userService = moduleFixture.get<UserService>(UserService);
    this.userResolver = moduleFixture.get<UserResolver>(UserResolver);
    this.questionnaireService = moduleFixture.get<QuestionnaireService>(QuestionnaireService);

    await this.app.listen(generateRandomPort());
    this.client = new GraphQLClient(`${await this.app.getUrl()}/graphql`);

    const defaultUserRequestHeaders = await initClients(
      this.userService,
      this.userResolver,
      this.userModel,
      this.eventEmitter,
      [UserRole.lagunaNurse, UserRole.lagunaCoach],
      true,
    );
    const defaultAdminRequestHeaders = await initClients(
      this.userService,
      this.userResolver,
      this.userModel,
      this.eventEmitter,
      [UserRole.lagunaAdmin],
      true,
    );

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
