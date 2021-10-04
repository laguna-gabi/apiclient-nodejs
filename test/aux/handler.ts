import { INestApplication, ValidationPipe } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import { Test, TestingModule } from '@nestjs/testing';
import { createTestClient } from 'apollo-server-testing';
import { AppModule } from '../../src/app.module';
import { Mutations } from './mutations';
import { Queries } from './queries';
import * as config from 'config';
import * as jwt from 'jsonwebtoken';
import { dbConnect, dbDisconnect, mockProviders } from '../common';
import { model } from 'mongoose';
import { MemberDto } from '../../src/member';
import { CommunicationService } from '../../src/communication';
import { WebhooksController } from '../../src/providers';

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
  memberModel;
  communicationService: CommunicationService;
  webhooksController: WebhooksController;

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
}
