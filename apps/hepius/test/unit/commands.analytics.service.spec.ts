import {
  dbDisconnect,
  defaultModules,
  generateId,
  generateNotesParams,
  generateObjectId,
  mockGenerateMember,
  mockGenerateMemberConfig,
  mockGenerateOrg,
  mockGenerateUser,
} from '../index';
import {
  AnalyticsModule,
  AnalyticsService,
  AppointmentAttendanceStatus,
  DateFormat,
  DateTimeFormat,
  GraduationPeriod,
  MemberDataAggregate,
  PopulatedAppointment,
  PopulatedMember,
} from '../../cmd';
import { add, sub } from 'date-fns';
import { RecordingType, reformatDate } from '../../src/common';
import { MemberModule } from '../../src/member';
import { AppointmentMethod, AppointmentStatus } from '../../src/appointment';
import { Test, TestingModule } from '@nestjs/testing';
import { ProvidersModule } from '../../src/providers';
import { Language, mockProcessWarnings } from '@argus/pandora';
import { hosts } from 'config';
import { Model, Types } from 'mongoose';
import { User, UserDocument, UserModule } from '../../src/user';
import { getModelToken } from '@nestjs/mongoose';

describe('Commands: AnalyticsService', () => {
  let module: TestingModule;
  let analyticsService: AnalyticsService;
  let userModel: Model<User>;

  const now = new Date(Date.UTC(2021, 1, 2, 3, 4, 5));

  // Mock actors
  const mockPrimaryUser = mockGenerateUser();
  const mockOrg = mockGenerateOrg();
  const mockFellowUser = mockGenerateUser();
  const mockMember = mockGenerateMember();
  const mockMemberConfig = mockGenerateMemberConfig();
  mockMember.primaryUserId = new Types.ObjectId(mockPrimaryUser.id);
  mockMember.dateOfBirth = reformatDate(sub(now, { years: 40 }).toString(), DateFormat);

  beforeAll(async () => {
    mockProcessWarnings(); // to hide pino prettyPrint warning
    module = await Test.createTestingModule({
      imports: defaultModules().concat(MemberModule, UserModule, ProvidersModule, AnalyticsModule),
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
        await analyticsService.buildAppointmentsMemberData({
          _id: new Types.ObjectId(mockMember.id),
          memberDetails: {
            ...mockMember,
            primaryUser: mockPrimaryUser,
          } as PopulatedMember,
        } as MemberDataAggregate),
      ).toEqual([
        {
          appt_number: 0,
          created: reformatDate(mockMember.createdAt.toString(), DateFormat),
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

      const data = await analyticsService.buildAppointmentsMemberData({
        _id: new Types.ObjectId(mockMember.id),
        memberDetails: {
          ...mockMember,
          dischargeDate: sub(now, { days: 89 }).toString(), // not graduated yet..
          primaryUserId: new Types.ObjectId(mockPrimaryUser.id),
          primaryUser: mockPrimaryUser,
        } as PopulatedMember,
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
          created: reformatDate(mockMember.createdAt.toString(), DateFormat),
          customer_id: mockMember.id,
          mbr_initials: analyticsService.getMemberInitials(mockMember),
          appt_number: 0,
          graduated: false,
          graduation_date: '2021-02-03',
        },
        {
          created: reformatDate(sub(now, { days: 10 }).toString(), DateTimeFormat),
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
          graduation_date: '2021-02-03',
          is_video_call: false,
          is_phone_call: true,
          harmony_link: generateHarmonyLink(mockMember.id),
          coach_name: `${mockPrimaryUser.firstName} ${mockPrimaryUser.lastName}`,
          coach_id: mockPrimaryUser.id,
        },
        {
          created: reformatDate(sub(now, { days: 15 }).toString(), DateTimeFormat),
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
          graduation_date: '2021-02-03',
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
          created: reformatDate(sub(now, { days: 10 }).toString(), DateTimeFormat),
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
          graduation_date: '2021-02-03',
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
    // eslint-disable-next-line max-len
    it('to return a calculated member data for analytics for a member in intervention group.', async () => {
      jest
        .spyOn(analyticsService, 'getDCFileLoadDate')
        .mockImplementationOnce(async () => sub(now, { days: 25 }))
        .mockImplementationOnce(async () => sub(now, { days: 15 }));

      const data = await analyticsService.buildMemberData({
        _id: new Types.ObjectId(mockMember.id),
        memberConfig: mockMemberConfig,
        memberDetails: {
          ...mockMember,
          admitDate: reformatDate(sub(now, { days: 20 }).toString(), DateFormat),
          dischargeDate: reformatDate(sub(now, { days: 10 }).toString(), DateFormat),
          primaryUserId: new Types.ObjectId(mockPrimaryUser.id),
          primaryUser: mockPrimaryUser,
          org: { ...mockOrg, _id: new Types.ObjectId(mockOrg.id) },
        } as PopulatedMember,
        appointments: [
          {
            start: sub(now, { days: 10 }),
            end: sub(now, { days: 9, hours: 23.5 }),
            notesData: {
              scores: {
                adherence: 4,
                wellbeing: 5,
              },
            },
          } as PopulatedAppointment,
          {
            start: sub(now, { days: 20 }),
            end: sub(now, { days: 20, hours: 23.5 }),
            notesData: {
              scores: {
                adherence: 1,
                wellbeing: 2,
              },
            },
          } as PopulatedAppointment,
        ],
      } as MemberDataAggregate);

      expect(data).toEqual({
        customer_id: mockMember.id,
        mbr_initials: mockMember.firstName[0].toUpperCase() + mockMember.lastName[0].toUpperCase(),
        created: reformatDate(mockMember.createdAt.toString(), DateTimeFormat),
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
        admit_date: '2021-01-13',
        discharge_date: '2021-01-23',
        los: 10,
        days_since_discharge: 10,
        active: true,
        graduated: false,
        graduation_date: '2021-04-23',
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
        updated: reformatDate(mockMember.updatedAt.toString(), DateTimeFormat),
        app_first_login: reformatDate(mockMemberConfig.firstLoggedInAt.toString(), DateTimeFormat),
        app_last_login: reformatDate(mockMemberConfig.updatedAt.toString(), DateTimeFormat),
        coach_id: mockPrimaryUser.id,
        org_id: mockOrg.id,
        org_name: mockOrg.name,
        general_notes: mockMember.generalNotes,
        nurse_notes: mockMember.nurseNotes,
      });
    });

    // eslint-disable-next-line max-len
    it('to return a calculated member data for analytics for a member in intervention group (not logged in).', async () => {
      jest
        .spyOn(analyticsService, 'getDCFileLoadDate')
        .mockImplementationOnce(async () => sub(now, { days: 25 }))
        .mockImplementationOnce(async () => sub(now, { days: 15 }));

      const data = await analyticsService.buildMemberData({
        _id: new Types.ObjectId(mockMember.id),
        memberConfig: { ...mockMemberConfig, firstLoggedInAt: undefined },
        memberDetails: {
          ...mockMember,
          admitDate: reformatDate(sub(now, { days: 20 }).toString(), DateFormat),
          dischargeDate: reformatDate(sub(now, { days: 10 }).toString(), DateFormat),
          primaryUserId: new Types.ObjectId(mockPrimaryUser.id),
          primaryUser: mockPrimaryUser,
          org: { ...mockOrg, _id: new Types.ObjectId(mockOrg.id) },
        } as PopulatedMember,
        appointments: [
          {
            start: sub(now, { days: 10 }),
            end: sub(now, { days: 9, hours: 23.5 }),
            notesData: {
              scores: {
                adherence: 4,
                wellbeing: 5,
              },
            },
          } as PopulatedAppointment,
          {
            start: sub(now, { days: 20 }),
            end: sub(now, { days: 20, hours: 23.5 }),
            notesData: {
              scores: {
                adherence: 1,
                wellbeing: 2,
              },
            },
          } as PopulatedAppointment,
        ],
      } as MemberDataAggregate);

      expect(data).toEqual({
        customer_id: mockMember.id,
        mbr_initials: mockMember.firstName[0].toUpperCase() + mockMember.lastName[0].toUpperCase(),
        created: reformatDate(mockMember.createdAt.toString(), DateTimeFormat),
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
        admit_date: '2021-01-13',
        discharge_date: '2021-01-23',
        los: 10,
        days_since_discharge: 10,
        active: true,
        graduated: false,
        graduation_date: '2021-04-23',
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
        updated: reformatDate(mockMember.updatedAt.toString(), DateTimeFormat),
        coach_id: mockPrimaryUser.id,
        org_id: mockOrg.id,
        org_name: mockOrg.name,
        general_notes: mockMember.generalNotes,
        nurse_notes: mockMember.nurseNotes,
      });
    });

    it('to return a calculated member data for analytics for a control member.', async () => {
      jest
        .spyOn(analyticsService, 'getDCFileLoadDate')
        .mockImplementationOnce(async () => undefined)
        .mockImplementationOnce(async () => undefined);

      const data = await analyticsService.buildMemberData({
        _id: new Types.ObjectId(mockMember.id),
        memberDetails: {
          ...mockMember,
          primaryUserId: undefined,
          org: { ...mockOrg, _id: new Types.ObjectId(mockOrg.id) },
        } as PopulatedMember,
        isControlMember: true,
      } as MemberDataAggregate);

      expect(data).toEqual({
        customer_id: mockMember.id,
        mbr_initials: mockMember.firstName[0].toUpperCase() + mockMember.lastName[0].toUpperCase(),
        created: reformatDate(mockMember.createdAt.toString(), DateTimeFormat),
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
        updated: reformatDate(mockMember.updatedAt.toString(), DateTimeFormat),
        dc_instructions_received: false,
        dc_summary_received: false,
        active: false,
        org_id: mockOrg.id,
        org_name: mockOrg.name,
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
      DateFormat,
    );

    const activeMember = mockGenerateMember();
    activeMember.dischargeDate = reformatDate(
      sub(now, { days: GraduationPeriod - 2 }).toString(),
      DateFormat,
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
        created: reformatDate(mockPrimaryUser.createdAt.toString(), DateTimeFormat),
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
});
