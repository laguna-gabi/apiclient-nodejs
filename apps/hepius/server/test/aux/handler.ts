import {
  Appointment,
  Barrier,
  BarrierDomain,
  BarrierType,
  CarePlan,
  CarePlanType,
  Caregiver,
  Notes,
  User,
  UserRole,
} from '@argus/hepiusClient';
import {
  AppRequestContext,
  TcpAuthInterceptor,
  mockLogger,
  mockProcessWarnings,
  requestContextMiddleware,
} from '@argus/pandora';
import { DiscoveryModule, DiscoveryService } from '@golevelup/nestjs-discovery';
import { ValidationPipe } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { GraphQLModule } from '@nestjs/graphql';
import { ClientProxy, ClientsModule, MicroserviceOptions, Transport } from '@nestjs/microservices';
import { getConnectionToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { datatype, lorem } from 'faker';
import { GraphQLClient } from 'graphql-request';
import { sign } from 'jsonwebtoken';
import { intersection } from 'lodash';
import { Model, model } from 'mongoose';
import { Consumer } from 'sqs-consumer';
import { v4 } from 'uuid';
import { Mutations, Queries } from '.';
import { generateCreateMemberParams, generateCreateUserParams, generateOrgParams } from '..';
import { buildGAD7Questionnaire, buildPHQ9Questionnaire } from '../../cmd/static';
import { ActionItem, ActionItemDocument, ActionItemDto } from '../../src/actionItem';
import { AppModule } from '../../src/app.module';
import {
  AppointmentDocument,
  AppointmentDto,
  NotesDocument,
  NotesDto,
} from '../../src/appointment';
import { AceGuard, EntityResolver, GlobalAuthGuard, RolesGuard } from '../../src/auth';
import { Availability, AvailabilityDocument, AvailabilityDto } from '../../src/availability';
import {
  BarrierDocument,
  BarrierDto,
  BarrierTypeDocument,
  BarrierTypeDto,
  CarePlanDocument,
  CarePlanDto,
  CarePlanTypeDocument,
  CarePlanTypeDto,
  CareService,
  RedFlag,
  RedFlagDocument,
  RedFlagDto,
  RedFlagType,
} from '../../src/care';
import { EventType, IEventOnNewUser, LoggerService, defaultAuditDbValues } from '../../src/common';
import {
  Communication,
  CommunicationDocument,
  CommunicationDto,
  CommunicationService,
} from '../../src/communication';
import {
  DailyReport,
  DailyReportDocument,
  DailyReportDto,
  DailyReportService,
} from '../../src/dailyReport';
import {
  CaregiverDocument,
  CaregiverDto,
  Journal,
  JournalDocument,
  JournalDto,
  Journey,
  JourneyDocument,
  JourneyDto,
  JourneyService,
} from '../../src/journey';
import {
  ControlMember,
  ControlMemberDocument,
  ControlMemberDto,
  Member,
  MemberDocument,
  MemberDto,
  MemberService,
} from '../../src/member';
import { Org, OrgService } from '../../src/org';
import { Internationalization, WebhooksController } from '../../src/providers';
import {
  Questionnaire,
  QuestionnaireDocument,
  QuestionnaireDto,
  QuestionnaireResponse,
  QuestionnaireResponseDocument,
  QuestionnaireResponseDto,
  QuestionnaireType,
} from '../../src/questionnaire';
import { Recording, RecordingDocument, RecordingDto, RecordingService } from '../../src/recording';
import {
  Todo,
  TodoDocument,
  TodoDone,
  TodoDoneDocument,
  TodoDoneDto,
  TodoDto,
} from '../../src/todo';
import {
  UserConfig,
  UserConfigDocument,
  UserConfigDto,
  UserDocument,
  UserDto,
  UserResolver,
  UserService,
} from '../../src/user';
import { BaseHandler, dbConnect, dbDisconnect, mockProviders } from '../common';

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
  communicationService: CommunicationService;
  memberService: MemberService;
  orgService: OrgService;
  careService: CareService;
  webhooksController: WebhooksController;
  spyOnGetCommunicationService;
  patientZero: Member;
  barrierType: BarrierType;
  redFlagType: RedFlagType;
  carePlanType: CarePlanType;
  lagunaOrg: Org | null;
  dailyReportService: DailyReportService;
  journeyService: JourneyService;
  client: GraphQLClient;
  defaultUserRequestHeaders;
  defaultAdminRequestHeaders;
  discoveryService: DiscoveryService;
  reflector: Reflector;
  recordingService: RecordingService;
  internationalization: Internationalization;

  controlMemberModel: Model<ControlMemberDocument>;
  barrierTypeModel: Model<BarrierTypeDocument>;
  caregiverModel: Model<CaregiverDocument>;
  todoModel: Model<TodoDocument>;
  recordingModel: Model<RecordingDocument>;
  todoDoneModel: Model<TodoDoneDocument>;
  actionItemModel: Model<ActionItemDocument>;
  questionnaireResponseModel: Model<QuestionnaireResponseDocument>;
  dailyReportModel: Model<DailyReportDocument & defaultAuditDbValues>;
  questionnaireModel: Model<QuestionnaireDocument>;
  availabilityModel: Model<AvailabilityDocument>;
  memberModel: Model<MemberDocument>;
  journalModel: Model<JournalDocument>;
  journeyModel: Model<JourneyDocument>;
  userModel: Model<UserDocument>;
  userConfigModel: Model<UserConfigDocument>;
  communicationModel: Model<CommunicationDocument>;
  redFlagModel: Model<RedFlagDocument>;
  barrierModel: Model<BarrierDocument>;
  carePlanModel: Model<CarePlanDocument>;
  carePlanTypeModel: Model<CarePlanTypeDocument>;
  appointmentModel: Model<AppointmentDocument>;
  notesModel: Model<NotesDocument>;

  async beforeAll() {
    mockProcessWarnings(); // to hide pino prettyPrint warning

    const tcpPort = datatype.number({ min: 1000, max: 3000 });
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        AppModule,
        ClientsModule.register([
          { name: 'TCP_TEST_CLIENT', transport: Transport.TCP, options: { port: tcpPort } },
        ]),
        DiscoveryModule,
      ],
    }).compile();

    this.app = moduleFixture.createNestApplication();

    this.app.useGlobalPipes(new ValidationPipe());

    this.reflector = this.app.get(Reflector);
    this.app.useGlobalGuards(new GlobalAuthGuard());
    this.app.useGlobalGuards(
      new RolesGuard(this.reflector),
      new AceGuard(this.reflector, new EntityResolver(this.app.get(getConnectionToken()))),
    );
    this.app.use(requestContextMiddleware(AppRequestContext));

    this.app.useGlobalInterceptors(new TcpAuthInterceptor());

    this.app.connectMicroservice<MicroserviceOptions>(
      {
        transport: Transport.TCP,
        options: {
          port: tcpPort,
        },
      },
      { inheritAppConfig: true },
    );

    this.app.useLogger(false);
    mockLogger(moduleFixture.get<LoggerService>(LoggerService));

    Consumer.create = jest.fn().mockImplementation(() => ({ on: jest.fn(), start: jest.fn() }));

    await this.app.init();

    this.tcpClient = moduleFixture.get<ClientProxy>('TCP_TEST_CLIENT');
    this.discoveryService = moduleFixture.get<DiscoveryService>(DiscoveryService);
    this.module = moduleFixture.get<GraphQLModule>(GraphQLModule);
    this.eventEmitter = moduleFixture.get<EventEmitter2>(EventEmitter2);
    this.dailyReportService = moduleFixture.get<DailyReportService>(DailyReportService);
    this.journeyService = moduleFixture.get<JourneyService>(JourneyService);
    const providers = mockProviders(moduleFixture);
    this.sendBird = providers.sendBird;
    this.oneSignal = providers.oneSignal;
    this.twilioService = providers.twilioService;
    this.slackBot = providers.slackBot;
    this.cognitoService = providers.cognitoService;
    this.storage = providers.storage;
    this.featureFlagService = providers.featureFlagService;
    this.queueService = providers.queueService;
    this.notificationService = providers.notificationService;
    this.recordingService = moduleFixture.get<RecordingService>(RecordingService);
    this.internationalization = moduleFixture.get<Internationalization>(Internationalization);

    await dbConnect();
    this.communicationService = moduleFixture.get<CommunicationService>(CommunicationService);
    this.userService = moduleFixture.get<UserService>(UserService);
    this.userResolver = moduleFixture.get<UserResolver>(UserResolver);
    this.memberService = moduleFixture.get<MemberService>(MemberService);
    this.orgService = moduleFixture.get<OrgService>(OrgService);
    this.careService = moduleFixture.get<CareService>(CareService);
    this.webhooksController = moduleFixture.get<WebhooksController>(WebhooksController);

    this.initModels();
    await this.buildFixtures();

    await this.app.startAllMicroservices();

    await this.app.listen(tcpPort + 1000);
    this.client = new GraphQLClient(`${await this.app.getUrl()}/graphql`);

    this.mutations = new Mutations(
      this.client,
      this.defaultUserRequestHeaders,
      this.defaultAdminRequestHeaders,
    );
    this.queries = new Queries(this.client, this.defaultUserRequestHeaders);

    await Promise.all([
      this.questionnaireModel.updateOne(
        { type: QuestionnaireType.phq9 },
        { $set: { ...buildPHQ9Questionnaire(), active: true } },
        { upsert: true },
      ),
      this.questionnaireModel.updateOne(
        { type: QuestionnaireType.gad7 },
        { $set: { ...buildGAD7Questionnaire(), active: true } },
        { upsert: true },
      ),
    ]);

    const { id: orgId } = await this.mutations.createOrg({ orgParams: generateOrgParams() });
    this.cognitoService.spyOnCognitoServiceAddUser.mockResolvedValueOnce({
      authId: v4(),
      username: v4(),
    });
    const user = await this.mutations.createUser({
      createUserParams: generateCreateUserParams({ orgs: [orgId] }),
    });
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
    this.storage.spyOnStorageHandleNewMember.mockReset();
    this.storage.spyOnStorageMultipartUpload.mockReset();
    this.storage.spyOnStorageCompleteMultipartUpload.mockReset();
    this.twilioService.spyOnTwilioGetToken.mockReset();
    this.twilioService.spyOnTwilioValidateWebhook.mockReset();
    this.slackBot.spyOnSlackBotSendMessage.mockReset();
    this.cognitoService.spyOnCognitoServiceAddUser.mockReset();
    this.cognitoService.spyOnCognitoServiceDisableClient.mockReset();
    this.cognitoService.spyOnCognitoServiceEnableClient.mockReset();
    this.cognitoService.spyOnCognitoServiceDeleteClient.mockReset();
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
      isCustom: false,
    });
    this.barrierType = await this.careService.createBarrierType({
      description: lorem.words(5),
      domain: BarrierDomain.medical,
      carePlanTypes: [this.carePlanType.id],
    });
    this.redFlagType = await this.careService.createRedFlagType(lorem.words(5));

    this.defaultUserRequestHeaders = await initClients(
      this.userService,
      this.userResolver,
      this.eventEmitter,
      [UserRole.lagunaNurse, UserRole.lagunaCoach],
    );
    this.defaultAdminRequestHeaders = await initClients(
      this.userService,
      this.userResolver,
      this.eventEmitter,
      [UserRole.lagunaAdmin],
    );
  }

  initModels() {
    this.controlMemberModel = model<ControlMemberDocument>(ControlMember.name, ControlMemberDto);
    this.barrierTypeModel = model<BarrierTypeDocument>(BarrierType.name, BarrierTypeDto);
    this.caregiverModel = model<CaregiverDocument>(Caregiver.name, CaregiverDto);
    this.todoModel = model<TodoDocument>(Todo.name, TodoDto);
    this.recordingModel = model<RecordingDocument>(Recording.name, RecordingDto);
    this.todoDoneModel = model<TodoDoneDocument>(TodoDone.name, TodoDoneDto);
    this.actionItemModel = model<ActionItemDocument>(ActionItem.name, ActionItemDto);
    this.questionnaireResponseModel = model<QuestionnaireResponseDocument>(
      QuestionnaireResponse.name,
      QuestionnaireResponseDto,
    );
    this.redFlagModel = model<RedFlagDocument>(RedFlag.name, RedFlagDto);
    this.barrierModel = model<BarrierDocument>(Barrier.name, BarrierDto);
    this.carePlanModel = model<CarePlanDocument>(CarePlan.name, CarePlanDto);
    this.carePlanTypeModel = model<CarePlanTypeDocument>(CarePlanType.name, CarePlanTypeDto);
    this.dailyReportModel = model<DailyReportDocument & defaultAuditDbValues>(
      DailyReport.name,
      DailyReportDto,
    );
    this.availabilityModel = model<AvailabilityDocument>(Availability.name, AvailabilityDto);
    this.memberModel = model<MemberDocument>(Member.name, MemberDto);
    this.journalModel = model<JournalDocument>(Journal.name, JournalDto);
    this.journeyModel = model<JourneyDocument>(Journey.name, JourneyDto);
    this.userModel = model<UserDocument>(User.name, UserDto);
    this.userConfigModel = model<UserConfigDocument>(UserConfig.name, UserConfigDto);
    this.communicationModel = model<CommunicationDocument>(Communication.name, CommunicationDto);
    this.questionnaireModel = model<QuestionnaireDocument>(Questionnaire.name, QuestionnaireDto);
    this.appointmentModel = model<AppointmentDocument>(Appointment.name, AppointmentDto);
    this.notesModel = model<NotesDocument>(Notes.name, NotesDto);
  }
}

export const initClients = async (
  userService: UserService,
  userResolver: UserResolver,
  eventEmitter: EventEmitter2,
  roles: UserRole[],
) => {
  const users = (await userService.getUsers()).filter(
    (user) => intersection(roles, user.roles).length,
  );
  let sub;
  if (users.length === 0) {
    const createUserParams = generateCreateUserParams({ roles });
    const { id } = await userService.insert(createUserParams);
    const user = await userService.updateAuthIdAndUsername(id, v4(), createUserParams.firstName);
    const eventParams: IEventOnNewUser = { user };
    eventEmitter.emit(EventType.onNewUser, eventParams);
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    userResolver.notifyUpdatedUserConfig(user);
    sub = user.authId;
  } else {
    sub = users[0].authId;
  }

  return {
    Authorization: sign({ sub }, 'secret'),
  };
};
