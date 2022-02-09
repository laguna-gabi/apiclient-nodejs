import { mockLogger, mockProcessWarnings } from '@lagunahealth/pandora';
import { ValidationPipe } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { GraphQLModule } from '@nestjs/graphql';
import { Test, TestingModule } from '@nestjs/testing';
import { createTestClient } from 'apollo-server-testing';
import * as config from 'config';
import * as jwt from 'jsonwebtoken';
import { Types } from 'mongoose';
import { Consumer } from 'sqs-consumer';
import { v4 } from 'uuid';
import { Mutations, Queries } from '.';
import {
  generateCreateUserParams,
  generateInternalCreateMemberParams,
  generateOrgParams,
} from '..';
import { AppModule } from '../../src/app.module';
import { GlobalAuthGuard, RolesGuard } from '../../src/auth';
import { LoggerService, bearerToken } from '../../src/common';
import { CommunicationService } from '../../src/communication';
import { DailyReportService } from '../../src/dailyReport';
import { Member, MemberService } from '../../src/member';
import { Org, OrgService } from '../../src/org';
import { WebhooksController } from '../../src/providers';
import { User, UserService } from '../../src/user';
import { BaseHandler, dbConnect, dbDisconnect, mockProviders } from '../common';

const validatorsConfig = config.get('graphql.validators');

export class Handler extends BaseHandler {
  sendBird;
  oneSignal;
  twilioService;
  slackBot;
  cognitoService;
  storage;
  featureFlagService;
  queueService;
  notificationService;
  eventEmitter: EventEmitter2;
  communicationService: CommunicationService;
  memberService: MemberService;
  orgService: OrgService;
  webhooksController: WebhooksController;
  spyOnGetCommunicationService;
  adminUser: User;
  patientZero: Member;
  lagunaOrg: Org | null;
  dailyReportService: DailyReportService;

  readonly minLength = validatorsConfig.get('name.minLength') as number;
  readonly maxLength = validatorsConfig.get('name.maxLength') as number;

  async beforeAll(withGuards = false) {
    mockProcessWarnings(); // to hide pino prettyPrint warning
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

    this.app.useLogger(false);
    mockLogger(moduleFixture.get<LoggerService>(LoggerService));

    Consumer.create = jest.fn().mockImplementation(() => ({ on: jest.fn(), start: jest.fn() }));

    await this.app.init();

    this.module = moduleFixture.get<GraphQLModule>(GraphQLModule);
    this.eventEmitter = moduleFixture.get<EventEmitter2>(EventEmitter2);
    this.dailyReportService = moduleFixture.get<DailyReportService>(DailyReportService);
    const providers = mockProviders(moduleFixture);
    this.sendBird = providers.sendBird;
    this.oneSignal = providers.oneSignal;
    this.twilioService = providers.twilioService;
    this.slackBot = providers.slackBot;
    this.cognitoService = providers.cognitoService;
    this.storage = providers.storage;
    this.featureFlagService = providers.featureFlagService;
    this.queueService = providers.queueService;
    this.cognitoService = providers.cognitoService;
    this.notificationService = providers.notificationService;
    const apolloServer = createTestClient(this.module.apolloServer);
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
    this.sendBird.spyOnSendBirdLeave.mockReset();
    this.sendBird.spyOnSendBirdInvite.mockReset();
    this.sendBird.spyOnSendBirdUpdateChannelName.mockReset();
    this.sendBird.spyOnSendBirdUpdateGroupChannelMetadata.mockReset();
    this.sendBird.spyOnSendBirdDeleteGroupChannelMetadata.mockReset();
    this.oneSignal.spyOnOneSignalRegister.mockReset();
    this.oneSignal.spyOnOneSignalUnregister.mockReset();
    this.storage.spyOnStorageDownload.mockReset();
    this.storage.spyOnStorageUpload.mockReset();
    this.storage.spyOnStorageDeleteRecordings.mockReset();
    this.storage.spyOnStorageDeleteJournalImages.mockReset();
    this.storage.spyOnStorageHandleNewMember.mockReset();
    this.twilioService.spyOnTwilioGetToken.mockReset();
    this.twilioService.spyOnTwilioValidateWebhook.mockReset();
    this.slackBot.spyOnSlackBotSendMessage.mockReset();
    this.cognitoService.spyOnCognitoServiceDisableMember.mockReset();
    this.cognitoService.spyOnCognitoServiceDeleteMember.mockReset();
    this.spyOnGetCommunicationService?.mockReset();
    this.queueService.spyOnQueueServiceSendMessage.mockReset();

    await dbDisconnect();
  }

  setContextUser = (deviceId?: string, sub?: string): Handler => {
    this.module.apolloServer['context'] = () => ({
      req: {
        headers: {
          authorization: bearerToken + jwt.sign({ username: deviceId, sub }, 'shhh'),
        },
      },
    });

    return this;
  };

  // Description: Generate a set of pre-defined fixtures
  async buildFixtures() {
    // Admin User - generated with the user service (circumventing the guards)
    this.adminUser = await this.userService.insert(generateCreateUserParams({ authId: v4() }));
    this.lagunaOrg = await this.orgService.get(
      (
        await this.orgService.insert(generateOrgParams())
      ).id,
    );
    this.patientZero = (
      await this.memberService.insert(
        generateInternalCreateMemberParams({ authId: v4(), orgId: this.lagunaOrg.id }),
        Types.ObjectId(this.adminUser.id),
      )
    ).member;
  }
}
