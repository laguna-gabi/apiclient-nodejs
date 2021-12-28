import {
  dbDisconnect,
  defaultModules,
  generateId,
  generateObjectId,
  mockGenerateMember,
  mockGenerateUser,
} from '../index';
import {
  AnalyticsService,
  AppointmentAttendanceStatus,
  DateFormat,
  MemberDataAggregate,
  PopulatedAppointment,
  PopulatedMember,
} from '../../cmd';
import { add, sub } from 'date-fns';
import { RecordingType, reformatDate } from '../../src/common';
import { MemberDocument, MemberModule } from '../../src/member';
import { AppointmentMethod, AppointmentStatus } from '../../src/appointment';
import { Test, TestingModule } from '@nestjs/testing';
import { AnalyticsModule } from '../../cmd';
import { ProvidersModule } from '../../src/providers';
import { Language, Platform } from '@lagunahealth/pandora';
import * as config from 'config';
import { Types } from 'mongoose';

describe('Commands: AnalyticsService', () => {
  let module: TestingModule;
  let analyticsService: AnalyticsService;

  const now = new Date(Date.UTC(2021, 1, 2, 3, 4, 5));

  // Mock actors
  const mockPrimaryUser = mockGenerateUser();
  const mockMember = mockGenerateMember();
  mockMember.primaryUserId = new Types.ObjectId(mockPrimaryUser.id);
  mockMember.dateOfBirth = reformatDate(sub(now, { years: 40 }).toString(), DateFormat);

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: defaultModules().concat(MemberModule, ProvidersModule, AnalyticsModule),
      providers: [AnalyticsService],
    }).compile();

    analyticsService = module.get<AnalyticsService>(AnalyticsService);
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
        totalOutreachAttempts: 0,
      });
    });

    // eslint-disable-next-line max-len
    it('to return an outreach attempt count with 0 duration when all recordings are for un-answered calls', async () => {
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
        totalOutreachAttempts: 2,
      });
    });

    // eslint-disable-next-line max-len
    it('to return an outreach attempt count (for un-answered) and a calculated duration (for answered) calls', async () => {
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
        totalOutreachAttempts: 2,
      });
    });
  });

  describe('getControlMemberData', () => {
    it('to return empty array for when no members in control group', async () => {
      expect(await analyticsService.getControlMemberData([])).toEqual([]);
    });

    it('to return a control members in control group', async () => {
      expect(
        await analyticsService.getControlMemberData([
          {
            ...mockMember,
            _id: new Types.ObjectId(mockMember.id),
          } as MemberDocument,
        ]),
      ).toEqual([
        {
          age: 40,
          city: mockMember.address.city,
          created: reformatDate(mockMember.createdAt.toString(), DateFormat),
          customer_id: mockMember.id,
          ethnicity: mockMember.ethnicity,
          gender: mockMember.sex,
          intervention_group: false,
          language: mockMember.language,
          mbr_initials: analyticsService.getMemberInitials(mockMember),
          race: mockMember.race,
          state: mockMember.address.state,
          street_address: mockMember.address.street,
          zip_code: mockMember.zipCode,
        },
      ]);
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
            note: {
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
            note: {
              scores: {
                adherence: 3,
                wellbeing: 4,
              },
            },
          } as PopulatedAppointment,
          {
            start: sub(now, { days: 10 }),
            end: sub(now, { days: 9 }),
            note: {
              scores: {
                adherence: 2,
                wellbeing: 3,
              },
            },
          } as PopulatedAppointment,
          {
            start: sub(now, { days: 2 }),
            end: sub(now, { days: 1 }),
            note: {
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
            end: sub(now, { days: 25 }),
            method: AppointmentMethod.phoneCall,
          } as PopulatedAppointment,
          {
            _id: app2Id,
            start: sub(now, { days: 5 }),
            method: AppointmentMethod.videoCall,
          } as PopulatedAppointment,
          {
            _id: app3Id,
            start: sub(now, { days: 10 }),
            end: sub(now, { days: 9, hours: 23.5 }),
            status: AppointmentStatus.done,
            method: AppointmentMethod.chat,
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
            start: sub(now, { days: 5 }),
            method: AppointmentMethod.phoneCall,
            noShow: true,
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
          created: reformatDate(mockMember.createdAt.toString(), DateFormat),
          customer_id: mockMember.id,
          mbr_initials: analyticsService.getMemberInitials(mockMember),
          chat_id: app4Id.toString(),
          appt_date: '2021-01-28',
          appt_time_ct: '03:04:05',
          appt_status: AppointmentAttendanceStatus.missed,
          appt_day_of_week_name: 'Thursday',
          appt_hour: '3',
          missed_appt: 'TRUE',
          total_duration: 0,
          total_outreach_attempts: 0,
          graduated: false,
          graduation_date: '2021-02-03',
          is_video_call: false,
          is_phone_call: true,
          harmony_link: config.get('hosts.harmony') + `/details/${mockMember.id}`,
          coach_name: `${mockPrimaryUser.firstName} ${mockPrimaryUser.lastName}`,
        },
        {
          created: reformatDate(mockMember.createdAt.toString(), DateFormat),
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
          missed_appt: 'FALSE',
          total_duration: 15,
          total_outreach_attempts: 0,
          channel_primary: RecordingType.phone,
          graduated: false,
          graduation_date: '2021-02-03',
          is_video_call: false,
          is_phone_call: false,
          harmony_link: config.get('hosts.harmony') + `/details/${mockMember.id}`,
          coach_name: `${mockPrimaryUser.firstName} ${mockPrimaryUser.lastName}`,
        },
        {
          created: reformatDate(mockMember.createdAt.toString(), DateFormat),
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
          harmony_link: config.get('hosts.harmony') + `/details/${mockMember.id}`,
          coach_name: `${mockPrimaryUser.firstName} ${mockPrimaryUser.lastName}`,
        },
      ]);
    });
  });

  describe('buildMemberData', () => {
    // eslint-disable-next-line max-len
    it('to return a calculated member data for analytics.', async () => {
      jest
        .spyOn(analyticsService, 'getDCFileLoadDate')
        .mockImplementationOnce(async () => sub(now, { days: 25 }))
        .mockImplementationOnce(async () => sub(now, { days: 15 }));

      const data = await analyticsService.buildMemberData({
        _id: new Types.ObjectId(mockMember.id),
        memberConfig: {
          platform: Platform.ios,
        },
        memberDetails: {
          ...mockMember,
          admitDate: reformatDate(sub(now, { days: 20 }).toString(), DateFormat),
          dischargeDate: reformatDate(sub(now, { days: 10 }).toString(), DateFormat),
          primaryUserId: new Types.ObjectId(mockPrimaryUser.id),
          primaryUser: mockPrimaryUser,
        } as PopulatedMember,
        appointments: [
          {
            start: sub(now, { days: 10 }),
            end: sub(now, { days: 9, hours: 23.5 }),
            note: {
              scores: {
                adherence: 4,
                wellbeing: 5,
              },
            },
          } as PopulatedAppointment,
          {
            start: sub(now, { days: 20 }),
            end: sub(now, { days: 20, hours: 23.5 }),
            note: {
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
        created: reformatDate(mockMember.createdAt.toString(), DateFormat),
        app_user: true,
        intervention_group: true,
        language: Language.en,
        age: 40,
        race: mockMember.race,
        ethnicity: mockMember.ethnicity,
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
        harmony_link: config.get('hosts.harmony') + `/details/${mockMember.id}`,
        coach_name: `${mockPrimaryUser.firstName} ${mockPrimaryUser.lastName}`,
      });
    });
  });
});
