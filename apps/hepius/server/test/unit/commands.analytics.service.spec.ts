import { Language, generateId, generateObjectId, mockProcessWarnings } from '@argus/pandora';
import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { hosts } from 'config';
import { add, differenceInDays, sub } from 'date-fns';
import { Model, Types } from 'mongoose';
import {
  dbDisconnect,
  defaultModules,
  generateNotesParams,
  mockDbBarrier,
  mockDbBarrierType,
  mockDbCarePlan,
  mockDbCarePlanType,
  mockDbRedFlag,
  mockDbRedFlagType,
  mockGenerateJourney,
  mockGenerateMember,
  mockGenerateMemberConfig,
  mockGenerateOrg,
  mockGenerateQuestionnaireAnswer,
  mockGenerateQuestionnaireResponse,
  mockGenerateUser,
} from '..';
import {
  AnalyticsModule,
  AnalyticsService,
  AppointmentAttendanceStatus,
  GraduationPeriod,
  MemberDataAggregate,
  PopulatedAppointment,
  PopulatedMember,
} from '../../cmd';
import { RecordingType, momentFormats, reformatDate } from '../../src/common';
import { MemberModule } from '../../src/member';
import { ProvidersModule } from '../../src/providers';
import { UserDocument, UserModule } from '../../src/user';
import { QuestionnaireModule, QuestionnaireResponse } from '../../src/questionnaire';
import { CareModule, RedFlag, RedFlagType } from '../../src/care';
import {
  AppointmentMethod,
  AppointmentStatus,
  Barrier,
  BarrierType,
  CarePlan,
  CarePlanType,
  Caregiver,
  User,
  mockGenerateCaregiver,
} from '@argus/hepiusClient';

describe('Commands: AnalyticsService', () => {
  let module: TestingModule;
  let analyticsService: AnalyticsService;
  let userModel: Model<User>;
  let caregiverModel: Model<Caregiver>;
  let qrModel: Model<QuestionnaireResponse>;
  let barrierTypesModel: Model<BarrierType>;
  let barriersModel: Model<Barrier>;
  let redFlagTypesModel: Model<RedFlagType>;
  let redFlagsModel: Model<RedFlag>;
  let carePlanTypesModel: Model<CarePlanType>;
  let carePlansModel: Model<CarePlan>;

  const now = new Date(Date.UTC(2021, 1, 2, 3, 4, 5));

  // Mock actors
  const mockPrimaryUser = mockGenerateUser();
  const mockOrg = mockGenerateOrg();
  const mockFellowUser = mockGenerateUser();
  const mockMember = mockGenerateMember();
  const mockMemberConfig = mockGenerateMemberConfig();
  const mockActiveJourney = mockGenerateJourney({ memberId: mockMember.id });
  mockMember.primaryUserId = new Types.ObjectId(mockPrimaryUser.id);
  mockMember.dateOfBirth = reformatDate(
    sub(now, { years: 40 }).toString(),
    momentFormats.mysqlDate,
  );

  beforeAll(async () => {
    mockProcessWarnings(); // to hide pino prettyPrint warning
    module = await Test.createTestingModule({
      imports: defaultModules().concat(
        MemberModule,
        UserModule,
        QuestionnaireModule,
        ProvidersModule,
        AnalyticsModule,
        CareModule,
      ),
      providers: [
        AnalyticsService,
        {
          provide: getModelToken(User.name),
          useValue: Model,
        },
      ],
    }).compile();

    analyticsService = module.get<AnalyticsService>(AnalyticsService);
    userModel = module.get<Model<User>>(getModelToken(User.name));
    caregiverModel = module.get<Model<Caregiver>>(getModelToken(Caregiver.name));
    qrModel = module.get<Model<QuestionnaireResponse>>(getModelToken(QuestionnaireResponse.name));
    barrierTypesModel = module.get<Model<BarrierType>>(getModelToken(BarrierType.name));
    barriersModel = module.get<Model<Barrier>>(getModelToken(Barrier.name));
    redFlagTypesModel = module.get<Model<RedFlagType>>(getModelToken(RedFlagType.name));
    redFlagsModel = module.get<Model<RedFlag>>(getModelToken(RedFlag.name));
    carePlanTypesModel = module.get<Model<CarePlanType>>(getModelToken(CarePlanType.name));
    carePlansModel = module.get<Model<CarePlan>>(getModelToken(CarePlan.name));

    // mock the user model to upload all actors (users) during init
    jest
      .spyOn(userModel, 'find')
      .mockResolvedValue([
        { ...mockPrimaryUser, _id: new Types.ObjectId(mockPrimaryUser.id) } as UserDocument,
        { ...mockFellowUser, _id: new Types.ObjectId(mockFellowUser.id) } as UserDocument,
      ]);
    await analyticsService.init();

    jest.spyOn(analyticsService, 'getDateTime').mockImplementation(() => now.getTime());
  });

  afterAll(async () => {
    await module.close();
    await dbDisconnect();
  });

  describe('getRecordingsSummary', () => {
    it('to return empty summary when no recordings', async () => {
      expect(analyticsService.getRecordingsSummary([])).toEqual({
        totalDuration: 0,
      });
    });

    // eslint-disable-next-line max-len
    it('to return 0 duration when all recordings are for un-answered calls', async () => {
      const memberId = generateObjectId();
      expect(
        analyticsService.getRecordingsSummary([
          {
            id: generateId(),
            memberId,
            answered: false,
          },
          {
            id: generateId(),
            memberId,
            answered: false,
          },
          {
            id: generateId(),
            memberId,
            answered: true,
          },
        ]),
      ).toEqual({
        totalDuration: 0,
      });
    });

    // eslint-disable-next-line max-len
    it('to return primary channel and total duration for answered calls', async () => {
      const memberId = generateObjectId();
      expect(
        analyticsService.getRecordingsSummary([
          {
            id: generateId(),
            memberId,
            answered: false,
            start: now,
            end: add(now, { seconds: 100 }),
            recordingType: RecordingType.phone,
          },
          {
            id: generateId(),
            memberId,
            answered: false,
            start: now,
            end: add(now, { seconds: 100 }),
            recordingType: RecordingType.phone,
          },
          {
            id: generateId(),
            memberId,
            answered: true,
            start: now,
            end: add(now, { seconds: 15 }),
            recordingType: RecordingType.phone,
          },
          {
            id: generateId(),
            memberId,
            answered: true,
            start: now,
            end: add(now, { seconds: 10 }),
            recordingType: RecordingType.phone,
          },
          {
            id: generateId(),
            memberId,
            answered: true,
            start: now,
            end: add(now, { seconds: 25 }),
            recordingType: RecordingType.video,
          },
        ]),
      ).toEqual({
        primaryChannel: RecordingType.video,
        totalDuration: 50,
      });
    });
  });

  describe('getActivationAndWellbeingStats', () => {
    // eslint-disable-next-line max-len
    it('to return empty (undefined) activation and wellbeing summary for an empty array of appointments)', async () => {
      expect(analyticsService.getActivationAndWellbeingStats([])).toEqual({
        firstActivationScore: undefined,
        firstWellbeingScore: undefined,
        lastActivationScore: undefined,
        lastWellbeingScore: undefined,
      });
    });

    it('to return activation and wellbeing according to first and last values', async () => {
      expect(
        analyticsService.getActivationAndWellbeingStats([
          {
            notesData: {
              // missing start/end - should be filtered out
              scores: {
                adherence: 4,
                wellbeing: 5,
              },
            },
          } as PopulatedAppointment,
          {
            start: sub(now, { days: 5 }),
            end: sub(now, { days: 4 }),
            notesData: {
              scores: {
                adherence: 3,
                wellbeing: 4,
              },
            },
          } as PopulatedAppointment,
          {
            start: sub(now, { days: 10 }),
            end: sub(now, { days: 9 }),
            notesData: {
              scores: {
                adherence: 2,
                wellbeing: 3,
              },
            },
          } as PopulatedAppointment,
          {
            start: sub(now, { days: 2 }),
            end: sub(now, { days: 1 }),
            notesData: {
              scores: {
                adherence: 1,
                wellbeing: 2,
              },
            },
          } as PopulatedAppointment,
        ]),
      ).toEqual({
        firstActivationScore: 2,
        firstWellbeingScore: 3,
        lastActivationScore: 1,
        lastWellbeingScore: 2,
      });
    });
  });

  describe('buildAppointmentsMemberData', () => {
    it('to return only appointment 0 even when there are no appointments', async () => {
      expect(
        analyticsService.buildAppointmentsMemberData({
          _id: new Types.ObjectId(mockMember.id),
          memberDetails: {
            ...mockMember,
            primaryUser: mockPrimaryUser,
          } as PopulatedMember,
          recentJourney: {
            ...mockActiveJourney,
          },
        } as MemberDataAggregate),
      ).toEqual([
        {
          appt_number: 0,
          created: reformatDate(mockMember.createdAt.toString(), momentFormats.mysqlDate),
          customer_id: mockMember.id,
          mbr_initials: analyticsService.getMemberInitials(mockMember),
          graduated: false,
          graduation_date: undefined,
        },
      ]);
    });

    // eslint-disable-next-line max-len
    it('to return sorted appointment where `non-scheduled` appointments are filtered out.', async () => {
      // Generate pre-defined ids for assertion
      const app1Id = generateObjectId();
      const app2Id = generateObjectId();
      const app3Id = generateObjectId();
      const app4Id = generateObjectId();

      const app3Notes = generateNotesParams();

      const data = analyticsService.buildAppointmentsMemberData({
        _id: new Types.ObjectId(mockMember.id),
        memberDetails: {
          ...mockMember,
          primaryUserId: new Types.ObjectId(mockPrimaryUser.id),
          primaryUser: mockPrimaryUser,
        } as PopulatedMember,
        recentJourney: {
          isGraduated: false,
        },
        appointments: [
          {
            _id: app1Id, // no start date so should be filtered out
            userId: new Types.ObjectId(mockFellowUser.id),
            end: sub(now, { days: 25 }),
            method: AppointmentMethod.phoneCall,
          } as PopulatedAppointment,
          {
            _id: app2Id,
            userId: new Types.ObjectId(mockPrimaryUser.id),
            start: sub(now, { days: 5 }),
            createdAt: sub(now, { days: 10 }),
            method: AppointmentMethod.videoCall,
          } as PopulatedAppointment,
          {
            _id: app3Id,
            userId: new Types.ObjectId(mockFellowUser.id),
            start: sub(now, { days: 10 }),
            createdAt: sub(now, { days: 15 }),
            end: sub(now, { days: 9, hours: 23.5 }),
            status: AppointmentStatus.done,
            method: AppointmentMethod.chat,
            noShow: false,
            notesData: app3Notes,
            recordings: [
              {
                id: generateId(),
                memberId: new Types.ObjectId(mockMember.id),
                answered: true,
                start: now,
                end: add(now, { seconds: 15 }),
                recordingType: RecordingType.phone,
              },
            ],
          } as PopulatedAppointment,
          {
            // no-show should appear first
            _id: app4Id,
            userId: new Types.ObjectId(mockPrimaryUser.id),
            start: sub(now, { days: 5 }),
            createdAt: sub(now, { days: 10 }),
            method: AppointmentMethod.phoneCall,
            noShow: true,
            noShowReason: 'no show reason',
          } as PopulatedAppointment,
        ],
      } as MemberDataAggregate);

      expect(data).toEqual([
        {
          created: reformatDate(mockMember.createdAt.toString(), momentFormats.mysqlDate),
          customer_id: mockMember.id,
          mbr_initials: analyticsService.getMemberInitials(mockMember),
          appt_number: 0,
          graduated: false,
        },
        {
          created: reformatDate(sub(now, { days: 10 }).toString(), momentFormats.mysqlDateTime),
          customer_id: mockMember.id,
          mbr_initials: analyticsService.getMemberInitials(mockMember),
          chat_id: app4Id.toString(),
          appt_date: '2021-01-28',
          appt_time_ct: '03:04:05',
          appt_status: AppointmentAttendanceStatus.missed,
          appt_day_of_week_name: 'Thursday',
          appt_hour: '3',
          missed_appt: true,
          no_show_reason: 'no show reason',
          total_duration: 0,
          total_outreach_attempts: 0,
          graduated: false,
          is_video_call: false,
          is_phone_call: true,
          harmony_link: generateHarmonyLink(mockMember.id),
          coach_name: `${mockPrimaryUser.firstName} ${mockPrimaryUser.lastName}`,
          coach_id: mockPrimaryUser.id,
        },
        {
          created: reformatDate(sub(now, { days: 15 }).toString(), momentFormats.mysqlDateTime),
          customer_id: mockMember.id,
          mbr_initials: analyticsService.getMemberInitials(mockMember),
          appt_number: 1,
          chat_id: app3Id.toString(),
          appt_date: '2021-01-23',
          appt_time_ct: '03:04:05',
          appt_status: AppointmentAttendanceStatus.attended,
          appt_day_of_week_name: 'Saturday',
          appt_hour: '3',
          status: 'done',
          missed_appt: false,
          total_duration: 15,
          total_outreach_attempts: 1,
          channel_primary: RecordingType.phone,
          graduated: false,
          is_video_call: false,
          is_phone_call: false,
          harmony_link: generateHarmonyLink(mockMember.id),
          coach_name: `${mockFellowUser.firstName} ${mockFellowUser.lastName}`,
          coach_id: mockFellowUser.id,
          wellbeing_score: app3Notes.scores.wellbeing,
          wellbeing_reason: app3Notes.scores.wellbeingText,
          activation_score: app3Notes.scores.adherence,
          activation_reason: app3Notes.scores.adherenceText,
          recap: app3Notes.recap,
          member_plan: app3Notes.memberActionItem,
          coach_plan: app3Notes.userActionItem,
          strengths: app3Notes.strengths,
        },
        {
          created: reformatDate(sub(now, { days: 10 }).toString(), momentFormats.mysqlDateTime),
          customer_id: mockMember.id,
          mbr_initials: analyticsService.getMemberInitials(mockMember),
          appt_number: 2,
          chat_id: app2Id.toString(),
          appt_date: '2021-01-28',
          appt_time_ct: '03:04:05',
          appt_day_of_week_name: 'Thursday',
          appt_hour: '3',
          total_duration: 0,
          total_outreach_attempts: 0,
          graduated: false,
          is_video_call: true,
          is_phone_call: false,
          harmony_link: generateHarmonyLink(mockMember.id),
          coach_name: `${mockPrimaryUser.firstName} ${mockPrimaryUser.lastName}`,
          coach_id: mockPrimaryUser.id,
        },
      ]);
    });
  });

  describe('buildMemberData', () => {
    let spyOnGetDCFileLoadDate;
    beforeEach(() => {
      spyOnGetDCFileLoadDate = jest.spyOn(analyticsService, 'getDCFileLoadDate');
    });

    afterEach(() => {
      spyOnGetDCFileLoadDate.mockReset();
    });

    // eslint-disable-next-line max-len
    it('to return a calculated member data for analytics for a member in intervention group.', async () => {
      spyOnGetDCFileLoadDate
        .mockImplementationOnce(async () => sub(now, { days: 25 }))
        .mockImplementationOnce(async () => sub(now, { days: 15 }));

      const data = await analyticsService.buildMemberData({
        _id: new Types.ObjectId(mockMember.id),
        memberConfig: mockMemberConfig,
        memberDetails: {
          ...mockMember,
          primaryUserId: new Types.ObjectId(mockPrimaryUser.id),
          primaryUser: mockPrimaryUser,
          org: { ...mockOrg, _id: new Types.ObjectId(mockOrg.id) },
        } as PopulatedMember,
        appointments: [
          {
            start: sub(now, { days: 10 }),
            end: sub(now, { days: 9, hours: 23.5 }),
            notesData: { scores: { adherence: 4, wellbeing: 5 } },
          } as PopulatedAppointment,
          {
            start: sub(now, { days: 20 }),
            end: sub(now, { days: 20, hours: 23.5 }),
            notesData: { scores: { adherence: 1, wellbeing: 2 } },
          } as PopulatedAppointment,
        ],
        recentJourney: {
          ...mockActiveJourney,
          isGraduated: true,
          graduationDate: sub(now, { days: 20 }),
        },
      } as MemberDataAggregate);

      expect(data).toMatchObject({
        customer_id: mockMember.id,
        mbr_initials: mockMember.firstName[0].toUpperCase() + mockMember.lastName[0].toUpperCase(),
        created: reformatDate(mockMember.createdAt.toString(), momentFormats.mysqlDateTime),
        app_user: true,
        intervention_group: true,
        language: Language.en,
        age: 40,
        race: mockMember.race,
        gender: mockMember.sex,
        street_address: mockMember.address.street,
        city: mockMember.address.city,
        state: mockMember.address.state,
        zip_code: mockMember.zipCode,
        admit_date: reformatDate(mockMember.admitDate, momentFormats.mysqlDate),
        discharge_date: reformatDate(mockMember.dischargeDate, momentFormats.mysqlDate),
        los: differenceInDays(
          Date.parse(mockMember.dischargeDate),
          Date.parse(mockMember.admitDate),
        ),
        days_since_discharge: differenceInDays(new Date(), Date.parse(mockMember.dischargeDate)),
        graduated: true,
        graduation_date: reformatDate(sub(now, { days: 20 }).toString(), momentFormats.mysqlDate),
        dc_summary_load_date: '2021-01-18',
        dc_summary_received: true,
        dc_instructions_load_date: '2021-01-08',
        dc_instructions_received: true,
        first_activation_score: 1,
        last_activation_score: 4,
        first_wellbeing_score: 2,
        last_wellbeing_score: 5,
        fellow: mockMember.fellowName,
        harmony_link: generateHarmonyLink(mockMember.id),
        coach_name: `${mockPrimaryUser.firstName} ${mockPrimaryUser.lastName}`,
        dob: mockMember.dateOfBirth,
        first_name: mockMember.firstName,
        last_name: mockMember.lastName,
        honorific: mockMember.honorific,
        phone: mockMember.phone,
        platform: mockMemberConfig.platform,
        updated: reformatDate(mockMember.updatedAt.toString(), momentFormats.mysqlDateTime),
        app_first_login: reformatDate(
          mockActiveJourney.firstLoggedInAt.toString(),
          momentFormats.mysqlDateTime,
        ),
        app_last_login: reformatDate(
          mockActiveJourney.lastLoggedInAt.toString(),
          momentFormats.mysqlDateTime,
        ),
        coach_id: mockPrimaryUser.id,
        org_id: mockOrg.id,
        org_name: mockOrg.name,
        general_notes: mockActiveJourney.generalNotes,
        nurse_notes: mockActiveJourney.nurseNotes,
        marital_status: mockMember.maritalStatus,
        height: mockMember.height,
        weight: mockMember.weight,
        deceased_cause: mockMember.deceased.cause,
        deceased_date: reformatDate(
          mockMember.deceased.date.toString(),
          momentFormats.mysqlDateTime,
        ),
        deceased_days_from_dc: mockMember.dischargeDate
          ? differenceInDays(
              Date.parse(mockMember.deceased.date),
              Date.parse(mockMember.dischargeDate),
            )
          : undefined,
        deceased_flag: true,
      });
    });

    // eslint-disable-next-line max-len
    it('to return a calculated member data for analytics for a member in intervention group (not logged in).', async () => {
      spyOnGetDCFileLoadDate
        .mockImplementationOnce(async () => sub(now, { days: 25 }))
        .mockImplementationOnce(async () => sub(now, { days: 15 }));

      const data = await analyticsService.buildMemberData({
        _id: new Types.ObjectId(mockMember.id),
        memberConfig: { ...mockMemberConfig },
        recentJourney: { ...mockActiveJourney, firstLoggedInAt: undefined },
        memberDetails: {
          ...mockMember,
          primaryUserId: new Types.ObjectId(mockPrimaryUser.id),
          primaryUser: mockPrimaryUser,
          org: { ...mockOrg, _id: new Types.ObjectId(mockOrg.id) },
        } as PopulatedMember,
        appointments: [
          {
            start: sub(now, { days: 10 }),
            end: sub(now, { days: 9, hours: 23.5 }),
            notesData: { scores: { adherence: 4, wellbeing: 5 } },
          } as PopulatedAppointment,
          {
            start: sub(now, { days: 20 }),
            end: sub(now, { days: 20, hours: 23.5 }),
            notesData: { scores: { adherence: 1, wellbeing: 2 } },
          } as PopulatedAppointment,
        ],
      } as MemberDataAggregate);

      expect(data).toMatchObject({
        customer_id: mockMember.id,
        mbr_initials: mockMember.firstName[0].toUpperCase() + mockMember.lastName[0].toUpperCase(),
        created: reformatDate(mockMember.createdAt.toString(), momentFormats.mysqlDateTime),
        app_user: true,
        intervention_group: true,
        language: Language.en,
        age: 40,
        race: mockMember.race,
        gender: mockMember.sex,
        street_address: mockMember.address.street,
        city: mockMember.address.city,
        state: mockMember.address.state,
        zip_code: mockMember.zipCode,
        admit_date: reformatDate(mockMember.admitDate, momentFormats.mysqlDate),
        discharge_date: reformatDate(mockMember.dischargeDate, momentFormats.mysqlDate),
        los: differenceInDays(
          Date.parse(mockMember.dischargeDate),
          Date.parse(mockMember.admitDate),
        ),
        days_since_discharge: differenceInDays(new Date(), Date.parse(mockMember.dischargeDate)),
        graduated: false,
        dc_summary_load_date: '2021-01-18',
        dc_summary_received: true,
        dc_instructions_load_date: '2021-01-08',
        dc_instructions_received: true,
        first_activation_score: 1,
        last_activation_score: 4,
        first_wellbeing_score: 2,
        last_wellbeing_score: 5,
        fellow: mockMember.fellowName,
        harmony_link: generateHarmonyLink(mockMember.id),
        coach_name: `${mockPrimaryUser.firstName} ${mockPrimaryUser.lastName}`,
        dob: mockMember.dateOfBirth,
        first_name: mockMember.firstName,
        last_name: mockMember.lastName,
        honorific: mockMember.honorific,
        phone: mockMember.phone,
        platform: mockMemberConfig.platform,
        updated: reformatDate(mockMember.updatedAt.toString(), momentFormats.mysqlDateTime),
        coach_id: mockPrimaryUser.id,
        org_id: mockOrg.id,
        org_name: mockOrg.name,
        general_notes: mockActiveJourney.generalNotes,
        nurse_notes: mockActiveJourney.nurseNotes,
        marital_status: mockMember.maritalStatus,
        height: mockMember.height,
        weight: mockMember.weight,
        deceased_cause: mockMember.deceased.cause,
        deceased_date: reformatDate(
          mockMember.deceased.date.toString(),
          momentFormats.mysqlDateTime,
        ),
        deceased_days_from_dc: mockMember.dischargeDate
          ? differenceInDays(
              Date.parse(mockMember.deceased.date),
              Date.parse(mockMember.dischargeDate),
            )
          : undefined,
        deceased_flag: true,
      });
    });

    it('to return a calculated member data for analytics for a control member.', async () => {
      spyOnGetDCFileLoadDate
        .mockImplementationOnce(async () => undefined)
        .mockImplementationOnce(async () => undefined);

      const data = await analyticsService.buildMemberData({
        _id: new Types.ObjectId(mockMember.id),
        memberDetails: {
          ...mockMember,
          deceased: null,
          primaryUserId: undefined,
          org: { ...mockOrg, _id: new Types.ObjectId(mockOrg.id) },
        } as PopulatedMember,
        isControlMember: true,
      } as MemberDataAggregate);

      expect(data).toMatchObject({
        customer_id: mockMember.id,
        mbr_initials: mockMember.firstName[0].toUpperCase() + mockMember.lastName[0].toUpperCase(),
        created: reformatDate(mockMember.createdAt.toString(), momentFormats.mysqlDateTime),
        intervention_group: false,
        age: 40,
        race: mockMember.race,
        gender: mockMember.sex,
        street_address: mockMember.address.street,
        city: mockMember.address.city,
        state: mockMember.address.state,
        zip_code: mockMember.zipCode,
        graduated: false,
        fellow: mockMember.fellowName,
        dob: mockMember.dateOfBirth,
        first_name: mockMember.firstName,
        last_name: mockMember.lastName,
        honorific: mockMember.honorific,
        phone: mockMember.phone,
        updated: reformatDate(mockMember.updatedAt.toString(), momentFormats.mysqlDateTime),
        dc_instructions_received: false,
        dc_summary_received: false,
        org_id: mockOrg.id,
        org_name: mockOrg.name,
        marital_status: mockMember.maritalStatus,
        height: mockMember.height,
        weight: mockMember.weight,
        deceased_cause: undefined,
        deceased_date: undefined,
        deceased_days_from_dc: undefined,
        deceased_flag: false,
      });
    });
  });

  const generateHarmonyLink = (memberId: string) => {
    return `${hosts.harmony}/details/${memberId}`;
  };

  describe('buildCoachData', () => {
    const graduatedMember = mockGenerateMember();
    graduatedMember.dischargeDate = reformatDate(
      sub(now, { days: GraduationPeriod + 2 }).toString(),
      momentFormats.mysqlDate,
    );

    const activeMember = mockGenerateMember();
    activeMember.dischargeDate = reformatDate(
      sub(now, { days: GraduationPeriod - 2 }).toString(),
      momentFormats.mysqlDate,
    );

    it('to return a calculated coach data.', async () => {
      const data = await analyticsService.buildCoachData({
        _id: new Types.ObjectId(mockPrimaryUser.id),
        members: [
          { ...graduatedMember, _id: new Types.ObjectId(graduatedMember.id) },
          { ...activeMember, _id: new Types.ObjectId(activeMember.id) },
        ],
        user: mockPrimaryUser,
      });

      expect(data).toEqual({
        created: reformatDate(mockPrimaryUser.createdAt.toString(), momentFormats.mysqlDateTime),
        user_id: mockPrimaryUser.id,
        first_name: mockPrimaryUser.firstName,
        last_name: mockPrimaryUser.lastName,
        roles: mockPrimaryUser.roles,
        title: mockPrimaryUser.title,
        phone: mockPrimaryUser.phone,
        email: mockPrimaryUser.email,
        spanish: mockPrimaryUser.languages?.includes(Language.es),
        bio: mockPrimaryUser.description,
        avatar: mockPrimaryUser.avatar,
        max_members: mockPrimaryUser.maxMembers,
        assigned_members: [activeMember.id],
      });
    });
  });

  describe('getCaregiversData', () => {
    let caregiverModelSpy;

    beforeAll(async () => {
      caregiverModelSpy = jest.spyOn(caregiverModel, 'find');
    });

    afterEach(() => {
      caregiverModelSpy.mockReset();
    });

    it('to return caregiver data objects', async () => {
      const cg1 = mockGenerateCaregiver();
      const cg2 = mockGenerateCaregiver();

      caregiverModelSpy.mockReturnValue({
        lean: () => {
          return [
            { ...cg1, _id: new Types.ObjectId(cg1.id) },
            { ...cg2, _id: new Types.ObjectId(cg2.id) },
          ];
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);
      const data = await analyticsService.getCaregiversData();

      expect(data?.map((entry) => ({ ...entry }))).toEqual([
        { ...cg1, memberId: cg1.memberId.toString() },
        { ...cg2, memberId: cg2.memberId.toString() },
      ]);
    });

    it('to return empty list of data objects', async () => {
      caregiverModelSpy.mockReturnValue({
        lean: () => {
          return;
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);
      const data = await analyticsService.getCaregiversData();

      expect(data).toEqual(undefined);
    });
  });

  describe('getQuestionnaireResponseData', () => {
    let qrModelSpy;

    beforeAll(async () => {
      qrModelSpy = jest.spyOn(qrModel, 'find');
    });

    afterEach(() => {
      qrModelSpy.mockReset();
    });

    it('to return an empty list of QR data entries', async () => {
      qrModelSpy.mockResolvedValue();
      const data = await analyticsService.getQuestionnaireResponseData();

      expect(data).toEqual([]);
    });

    it('to return non-empty QR data entries', async () => {
      const answer1 = mockGenerateQuestionnaireAnswer();
      const answer2 = mockGenerateQuestionnaireAnswer();
      const questionnaireResponse = mockGenerateQuestionnaireResponse({
        answers: [answer1, answer2],
      });

      qrModelSpy.mockResolvedValue([
        { ...questionnaireResponse, _id: new Types.ObjectId(questionnaireResponse.id) },
      ]);

      const data = await analyticsService.getQuestionnaireResponseData();

      expect(data).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            answer_code: answer1.code,
            answer_value: answer1.value,
            member_id: questionnaireResponse.memberId.toString(),
            qr_id: questionnaireResponse.id,
            questionnaire_id: questionnaireResponse.questionnaireId.toString(),
          }),
          expect.objectContaining({
            answer_code: answer2.code,
            answer_value: answer2.value,
            member_id: questionnaireResponse.memberId.toString(),
            qr_id: questionnaireResponse.id,
            questionnaire_id: questionnaireResponse.questionnaireId.toString(),
          }),
        ]),
      );
    });
  });

  describe('barriers', () => {
    let barrierTypesModelSpy;
    let barriersModelSpy;

    beforeAll(async () => {
      barrierTypesModelSpy = jest.spyOn(barrierTypesModel, 'find');
      barriersModelSpy = jest.spyOn(barriersModel, 'find');
    });

    afterEach(() => {
      barrierTypesModelSpy.mockReset();
      barriersModelSpy.mockReset();
    });

    it('should return an empty list of barrier types data entries', async () => {
      barrierTypesModelSpy.mockReturnValueOnce([]);
      const data = await analyticsService.getBarrierTypesData();
      expect(data).toEqual([]);
    });

    it('should return an empty list of barriers data entries', async () => {
      barriersModelSpy.mockReturnValueOnce([]);
      const data = await analyticsService.getBarriersData();
      expect(data).toEqual([]);
    });

    it('should return non-empty barrier types data entries', async () => {
      const barrierTypes = [mockDbBarrierType(), mockDbBarrierType()];
      barrierTypesModelSpy.mockReturnValue(barrierTypes);
      const data = await analyticsService.getBarrierTypesData();

      expect(data).toEqual(
        expect.arrayContaining(
          barrierTypes.map((barrier) => ({
            id: barrier._id.toString(),
            description: barrier.description,
            domain: barrier.domain,
            carePlanTypes: barrier.carePlanTypes.map((item) => item.toString()),
          })),
        ),
      );
    });

    it('should return non-empty barriers data entries', async () => {
      const barriers = [mockDbBarrier(), mockDbBarrier()];
      barriersModelSpy.mockReturnValue(barriers);
      const data = await analyticsService.getBarriersData();

      expect(data).toEqual(
        expect.arrayContaining(
          barriers.map((barrier) => ({
            id: barrier._id.toString(),
            member_id: barrier.memberId.toString(),
            created: reformatDate(barrier.createdAt.toString(), momentFormats.mysqlDateTime),
            updated: reformatDate(barrier.updatedAt.toString(), momentFormats.mysqlDateTime),
            status: barrier.status,
            notes: barrier.notes,
            completed: reformatDate(barrier.completedAt?.toString(), momentFormats.mysqlDateTime),
            type: barrier.type.toString(),
            redFlagId: barrier.redFlagId.toString(),
          })),
        ),
      );
    });
  });

  describe('red flags', () => {
    let redFlagTypesModelSpy;
    let redFlagsModelSpy;

    beforeAll(async () => {
      redFlagTypesModelSpy = jest.spyOn(redFlagTypesModel, 'find');
      redFlagsModelSpy = jest.spyOn(redFlagsModel, 'find');
    });

    afterEach(() => {
      redFlagTypesModelSpy.mockReset();
      redFlagsModelSpy.mockReset();
    });

    it('should return an empty list of barriers types data entries', async () => {
      redFlagTypesModelSpy.mockReturnValueOnce([]);
      const data = await analyticsService.getRedFlagTypeData();
      expect(data).toEqual([]);
    });

    it('should return an empty list of barrier data entries', async () => {
      redFlagsModelSpy.mockReturnValueOnce([]);
      const data = await analyticsService.getRedFlagData();
      expect(data).toEqual([]);
    });

    it('should return non-empty red flag types data entries', async () => {
      const redFlagsTypes = [mockDbRedFlagType(), mockDbRedFlagType()];
      redFlagTypesModelSpy.mockReturnValue(redFlagsTypes);
      const data = await analyticsService.getRedFlagTypeData();

      expect(data).toEqual(
        expect.arrayContaining(
          redFlagsTypes.map((input) => ({
            id: input._id.toString(),
            description: input.description,
          })),
        ),
      );
    });

    it('should return non-empty red flag data entries', async () => {
      const redFlags = [mockDbRedFlag(), mockDbRedFlag()];
      redFlagsModelSpy.mockReturnValue(redFlags);
      const data = await analyticsService.getRedFlagData();

      expect(data).toEqual(
        expect.arrayContaining(
          redFlags.map((redFlag) => ({
            id: redFlag._id.toString(),
            member_id: redFlag.memberId.toString(),
            created: reformatDate(redFlag.createdAt.toString(), momentFormats.mysqlDateTime),
            updated: reformatDate(redFlag.updatedAt.toString(), momentFormats.mysqlDateTime),
            type: redFlag.type.toString(),
            notes: redFlag.notes,
          })),
        ),
      );
    });
  });

  describe('care plans', () => {
    let carePlanTypesModelSpy;
    let carePlansModelSpy;

    beforeAll(async () => {
      carePlanTypesModelSpy = jest.spyOn(carePlanTypesModel, 'find');
      carePlansModelSpy = jest.spyOn(carePlansModel, 'find');
    });

    afterEach(() => {
      carePlanTypesModelSpy.mockReset();
      carePlansModelSpy.mockReset();
    });

    it('should return an empty list of care plan types data entries', async () => {
      carePlanTypesModelSpy.mockReturnValueOnce([]);
      const data = await analyticsService.getCarePlanTypesData();
      expect(data).toEqual([]);
    });

    it('should return an empty list of care plan data entries', async () => {
      carePlansModelSpy.mockReturnValueOnce([]);
      const data = await analyticsService.getCarePlansData();
      expect(data).toEqual([]);
    });

    it('should return non-empty care plan types data entries', async () => {
      const carePlanTypes = [mockDbCarePlanType(), mockDbCarePlanType()];
      carePlanTypesModelSpy.mockReturnValue(carePlanTypes);
      const data = await analyticsService.getCarePlanTypesData();

      expect(data).toEqual(
        expect.arrayContaining(
          carePlanTypes.map((barrier) => ({
            id: barrier._id.toString(),
            description: barrier.description,
            isCustom: barrier.isCustom,
          })),
        ),
      );
    });

    it('should return non-empty care plans data entries', async () => {
      const carePlans = [mockDbCarePlan(), mockDbCarePlan()];
      carePlansModelSpy.mockReturnValue(carePlans);
      const data = await analyticsService.getCarePlansData();

      expect(data).toEqual(
        expect.arrayContaining(
          carePlans.map((carePlan) => ({
            id: carePlan._id.toString(),
            member_id: carePlan.memberId.toString(),
            created: reformatDate(carePlan.createdAt.toString(), momentFormats.mysqlDateTime),
            updated: reformatDate(carePlan.updatedAt.toString(), momentFormats.mysqlDateTime),
            status: carePlan.status,
            notes: carePlan.notes,
            completed: reformatDate(carePlan.completedAt?.toString(), momentFormats.mysqlDateTime),
            type: carePlan.type.toString(),
            barrierId: carePlan.barrierId.toString(),
            dueDate: reformatDate(carePlan.dueDate.toString(), momentFormats.mysqlDateTime),
          })),
        ),
      );
    });
  });
});
