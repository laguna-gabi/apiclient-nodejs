import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { GraphQLModule } from '@nestjs/graphql';
import { SchedulerRegistry } from '@nestjs/schedule';
import { Test, TestingModule } from '@nestjs/testing';
import { createTestClient } from 'apollo-server-testing';
import * as config from 'config';
import * as faker from 'faker';
import * as jwt from 'jsonwebtoken';
import { Org, OrgService } from '../../src/org';
import { User, UserService } from '../../src/user';
import { v4 } from 'uuid';
import { AppModule } from '../../src/app.module';
import { GlobalAuthGuard, RolesGuard } from '../../src/auth';
import { bearerToken } from '../../src/common';
import { CommunicationService } from '../../src/communication';
import { Member, MemberService } from '../../src/member';
import { WebhooksController } from '../../src/providers';
import { dbConnect, dbDisconnect, mockProviders } from '../common';
import {
  generateCreateMemberParams,
  generateCreateUserParams,
  generateId,
  generateOrgParams,
  generateUniqueUrl,
} from '..';
import { Mutations, Queries } from '.';

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
  communicationService: CommunicationService;
  userService: UserService;
  memberService: MemberService;
  orgService: OrgService;
  webhooksController: WebhooksController;
  schedulerRegistry: SchedulerRegistry;
  spyOnGetCommunicationService;
  adminUser: User;
  patientZero: Member;
  lagunaOrg: Org;

  readonly minLength = validatorsConfig.get('name.minLength') as number;
  readonly maxLength = validatorsConfig.get('name.maxLength') as number;

  async beforeAll(withGuards = false) {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    this.app = moduleFixture.createNestApplication();
    this.app.useGlobalPipes(new ValidationPipe());

    if (withGuards) {
      const reflector = this.app.get(Reflector);
      this.app.useGlobalGuards(new GlobalAuthGuard());
      this.app.useGlobalGuards(new RolesGuard(reflector));
    }

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

    this.communicationService = moduleFixture.get<CommunicationService>(CommunicationService);
    this.userService = moduleFixture.get<UserService>(UserService);
    this.memberService = moduleFixture.get<MemberService>(MemberService);
    this.orgService = moduleFixture.get<OrgService>(OrgService);
    this.webhooksController = moduleFixture.get<WebhooksController>(WebhooksController);

    await this.buildFixtures();
  }

  async afterAll() {
    await this.app.close();

    this.sendBird.spyOnSendBirdCreateUser.mockReset();
    this.sendBird.spyOnSendBirdCreateGroupChannel.mockReset();
    this.sendBird.spyOnSendBirdFreeze.mockReset();
    this.sendBird.spyOnSendBirdSend.mockReset();
    this.sendBird.spyOnSendBirdUpdateGroupChannelMetadata.mockReset();
    this.sendBird.spyOnSendBirdDeleteGroupChannelMetadata.mockReset();
    this.notificationsService.spyOnNotificationsServiceRegister.mockReset();
    this.notificationsService.spyOnNotificationsServiceSend.mockReset();
    this.notificationsService.spyOnNotificationsServiceCancel.mockReset();
    this.twilioService.spyOnTwilioGetToken.mockReset();
    this.slackBot.spyOnSlackBotSendMessage.mockReset();
    this.spyOnGetCommunicationService?.mockReset();

    await dbDisconnect();
  }

  setContextUser = (deviceId?: string, sub?: string): Handler => {
    (this.module as any).apolloServer.context = () => ({
      req: {
        headers: {
          authorization: bearerToken + jwt.sign({ username: deviceId, sub }, 'shhh'),
        },
      },
    });

    return this;
  };

  mockCommunication() {
    const mockCommunicationParams = {
      memberId: generateId(),
      userId: v4(),
      sendBirdChannelUrl: generateUniqueUrl(),
      chat: { memberLink: faker.internet.url(), userLink: faker.internet.url() },
    };
    this.spyOnGetCommunicationService = jest.spyOn(this.communicationService, 'get');
    this.spyOnGetCommunicationService.mockImplementation(async () => mockCommunicationParams);
    return mockCommunicationParams;
  }

  // Description: Generate a set of pre-defined fixtures
  async buildFixtures() {
    // Admin User - generated with the user service (circumventing the guards)
    this.adminUser = await this.userService.insert(generateCreateUserParams({ authId: v4() }));
    this.lagunaOrg = await this.orgService.get(
      (
        await this.orgService.insert(generateOrgParams())
      ).id,
    );
    this.patientZero = await this.memberService.insert(
      generateCreateMemberParams({ authId: v4(), orgId: this.lagunaOrg.id }),
      this.adminUser.id,
    );
  }
}
