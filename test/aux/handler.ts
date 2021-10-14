import { INestApplication, ValidationPipe } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { GraphQLModule } from '@nestjs/graphql';
import { SchedulerRegistry } from '@nestjs/schedule';
import { Test, TestingModule } from '@nestjs/testing';
import { createTestClient } from 'apollo-server-testing';
import * as config from 'config';
import * as faker from 'faker';
import * as jwt from 'jsonwebtoken';
import { model } from 'mongoose';
import { v4 } from 'uuid';
import { AppModule } from '../../src/app.module';
import { CommunicationService } from '../../src/communication';
import { MemberDto } from '../../src/member';
import { WebhooksController } from '../../src/providers';
import { dbConnect, dbDisconnect, mockProviders } from '../common';
import { generateId } from '../generators';
import { Mutations } from './mutations';
import { Queries } from './queries';

const validatorsConfig = config.get('graphql.validators');

export class Handler {
  app: INestApplication;
  mutations: Mutations;
  queries: Queries;
  module: GraphQLModule;
  sendBird;
  notificationsService;
  twilioService;
  slackBot;
  eventEmitter: EventEmitter2;
  memberModel;
  communicationService: CommunicationService;
  webhooksController: WebhooksController;
  schedulerRegistry: SchedulerRegistry;
  spyOnGetCommunicationService;

  readonly minLength = validatorsConfig.get('name.minLength') as number;
  readonly maxLength = validatorsConfig.get('name.maxLength') as number;

  async beforeAll() {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    this.app = moduleFixture.createNestApplication();
    this.app.useGlobalPipes(new ValidationPipe());
    await this.app.init();

    this.module = moduleFixture.get<GraphQLModule>(GraphQLModule);
    this.schedulerRegistry = moduleFixture.get<SchedulerRegistry>(SchedulerRegistry);
    this.eventEmitter = moduleFixture.get<EventEmitter2>(EventEmitter2);
    const providers = mockProviders(moduleFixture);
    this.sendBird = providers.sendBird;
    this.notificationsService = providers.notificationsService;
    this.twilioService = providers.twilioService;
    this.slackBot = providers.slackBot;

    const apolloServer = createTestClient((this.module as any).apolloServer);
    this.mutations = new Mutations(apolloServer);
    this.queries = new Queries(apolloServer);

    await dbConnect();
    this.memberModel = model('members', MemberDto);

    this.communicationService = moduleFixture.get<CommunicationService>(CommunicationService);
    this.webhooksController = moduleFixture.get<WebhooksController>(WebhooksController);
  }

  async afterAll() {
    await this.app.close();

    this.sendBird.spyOnSendBirdCreateUser.mockReset();
    this.sendBird.spyOnSendBirdCreateGroupChannel.mockReset();
    this.sendBird.spyOnSendBirdFreeze.mockReset();
    this.sendBird.spyOnSendBirdUpdateGroupChannelMetadata.mockReset();
    this.sendBird.spyOnSendBirdDeleteGroupChannelMetadata.mockReset();
    this.notificationsService.spyOnNotificationsServiceRegister.mockReset();
    this.notificationsService.spyOnNotificationsServiceSend.mockReset();
    this.notificationsService.spyOnNotificationsServiceCancel.mockReset();
    this.twilioService.spyOnTwilioGetToken.mockReset();
    this.slackBot.spyOnSlackBotSendMessage.mockReset();
    this.spyOnGetCommunicationService.mockReset();

    await dbDisconnect();
  }

  setContextUser = (deviceId: string) => {
    (this.module as any).apolloServer.context = () => ({
      req: {
        headers: {
          authorization: jwt.sign({ username: deviceId }, 'shhh'),
        },
      },
    });
  };

  mockCommunication() {
    this.spyOnGetCommunicationService = jest.spyOn(this.communicationService, 'get');
    this.spyOnGetCommunicationService.mockImplementation(async () => ({
      memberId: generateId(),
      userId: v4(),
      sendbirdChannelUrl: v4(),
      chat: { memberLink: faker.internet.url(), userLink: faker.internet.url() },
    }));
  }
}
