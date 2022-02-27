import { mockLogger, mockProcessWarnings } from '@lagunahealth/pandora';
import { ValidationPipe } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { GraphQLModule } from '@nestjs/graphql';
import { Test, TestingModule } from '@nestjs/testing';
import * as config from 'config';
import { datatype, lorem } from 'faker';
import { GraphQLClient } from 'graphql-request';
import * as jwt from 'jsonwebtoken';
import { Model, model } from 'mongoose';
import { Consumer } from 'sqs-consumer';
import { Mutations, Queries } from '.';
import {
  generateCreateMemberParams,
  generateCreateUserParams,
  generateId,
  generateOrgParams,
} from '..';
import { AppModule } from '../../src/app.module';
import { GlobalAuthGuard, RolesGuard } from '../../src/auth';
import {
  BarrierDomain,
  BarrierType,
  BarrierTypeDocument,
  BarrierTypeDto,
  CarePlanType,
  CareService,
} from '../../src/care';
import { LoggerService, UserRole } from '../../src/common';
import { CommunicationService } from '../../src/communication';
import { DailyReportService } from '../../src/dailyReport';
import { Member, MemberService } from '../../src/member';
import { Org, OrgService } from '../../src/org';
import { WebhooksController } from '../../src/providers';
import { UserService } from '../../src/user';
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
  careService: CareService;
  barrierTypeModel: Model<BarrierTypeDocument>;
  webhooksController: WebhooksController;
  spyOnGetCommunicationService;
  patientZero: Member;
  barrierType: BarrierType;
  carePlanType: CarePlanType;
  lagunaOrg: Org | null;
  dailyReportService: DailyReportService;
  client: GraphQLClient;
  defaultUserRequestHeaders;
  defaultAdminRequestHeaders;

  readonly minLength = validatorsConfig.get('name.minLength') as number;
  readonly maxLength = validatorsConfig.get('name.maxLength') as number;

  async beforeAll() {
    mockProcessWarnings(); // to hide pino prettyPrint warning
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    this.app = moduleFixture.createNestApplication();
    this.app.useGlobalPipes(new ValidationPipe());

    const reflector = this.app.get(Reflector);
    this.app.useGlobalGuards(new GlobalAuthGuard());
    this.app.useGlobalGuards(new RolesGuard(reflector));

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

    await dbConnect();
    this.communicationService = moduleFixture.get<CommunicationService>(CommunicationService);
    this.userService = moduleFixture.get<UserService>(UserService);
    this.memberService = moduleFixture.get<MemberService>(MemberService);
    this.orgService = moduleFixture.get<OrgService>(OrgService);
    this.careService = moduleFixture.get<CareService>(CareService);
    this.webhooksController = moduleFixture.get<WebhooksController>(WebhooksController);
    this.barrierTypeModel = model<BarrierTypeDocument>(BarrierType.name, BarrierTypeDto);

    await this.buildFixtures();
    await this.app.listen(datatype.number({ min: 4000, max: 9000 }));
    this.client = new GraphQLClient(`${await this.app.getUrl()}/graphql`);

    this.mutations = new Mutations(
      this.client,
      this.defaultUserRequestHeaders,
      this.defaultAdminRequestHeaders,
    );
    this.queries = new Queries(this.client, this.defaultUserRequestHeaders);

    const { id: orgId } = await this.mutations.createOrg({ orgParams: generateOrgParams() });
    const user = await this.mutations.createUser({ userParams: generateCreateUserParams() });
    const memberParams = generateCreateMemberParams({ userId: user.id, orgId });
    const { id } = await this.mutations.createMember({ memberParams });
    this.patientZero = await this.queries.getMember({ id });
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

  // Description: Generate a set of pre-defined fixtures
  async buildFixtures() {
    // Admin User - generated with the user service (circumventing the guards)
    this.lagunaOrg = await this.orgService.get(
      (
        await this.orgService.insert(generateOrgParams())
      ).id,
    );
    this.carePlanType = await this.careService.createCarePlanType({
      description: lorem.words(5),
      createdBy: generateId(),
      isCustom: false,
    });
    this.barrierType = await this.barrierTypeModel.create({
      description: lorem.words(5),
      domain: BarrierDomain.medical,
      carePlanTypes: [this.carePlanType.id],
    });

    this.defaultUserRequestHeaders = await initClients(this.userService, [
      UserRole.nurse,
      UserRole.coach,
    ]);
    this.defaultAdminRequestHeaders = await initClients(this.userService, [UserRole.admin]);
  }
}

export const initClients = async (userService: UserService, roles: UserRole[]) => {
  const users = await userService.getUsers(roles);
  let sub;
  if (users.length === 0) {
    const createUserParams = generateCreateUserParams({ roles });
    await userService.insert(createUserParams);
    sub = createUserParams.authId;
  } else {
    sub = users[0].authId;
  }

  return {
    Authorization: jwt.sign({ sub }, 'secret'),
  };
};
