import { Language, Platform } from '@lagunahealth/pandora';
import { AppointmentStatus, RecordingType, StorageType, reformatDate } from '../../src/common';
import {
  AppointmentAttendanceStatus,
  AppointmentsMemberData,
  BaseMember,
  CoachData,
  CoachDataAggregate,
  DateFormat,
  DateTimeFormat,
  DayOfWeekFormat,
  GraduationPeriod,
  HarmonyLink,
  HourFormat,
  InstructionsFileSuffix,
  MemberData,
  MemberDataAggregate,
  PopulatedAppointment,
  PopulatedMember,
  RecordingSummary,
  SheetOption,
  SummaryFileSuffix,
  TimeFormat,
} from '.';
import { add, differenceInDays, differenceInSeconds, differenceInYears } from 'date-fns';
import { Injectable } from '@nestjs/common';
import { AppointmentMethod } from '../../src/appointment';
import { Member, MemberDocument, MemberService, Recording } from '../../src/member';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model, Types } from 'mongoose';
import { StorageService } from '../../src/providers';
import { User, UserDocument } from '../../src/user';
import * as fs from 'fs';
import { json2csv } from 'json-2-csv';

@Injectable()
export class AnalyticsService {
  constructor(
    private readonly memberService: MemberService,
    @InjectModel(Member.name)
    private readonly memberModel: Model<MemberDocument>,
    private readonly storageService: StorageService,
    @InjectConnection() private connection: Connection,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
  ) {}

  private userData: Map<string, string>;

  async init() {
    // upload users - full name is required for the appointment entry
    await this.uploadUserData();
  }

  async clean() {
    this.connection.close();
  }

  // Description: get all control members
  async getAllControl(): Promise<MemberDataAggregate[]> {
    const controlMembers = await this.memberService.getAllControl();

    return controlMembers.map(
      (member) =>
        ({
          _id: new Types.ObjectId(member.id),
          memberDetails: member as PopulatedMember,
          isControlMember: true,
        } as MemberDataAggregate),
    );
  }

  async uploadUserData(): Promise<void> {
    this.userData = new Map<string, string>();

    const users = await this.userModel.find({}, { _id: 1, firstName: 1, lastName: 1 });

    users.forEach((user) => {
      this.userData.set(user._id.toString(), `${user.firstName} ${user.lastName}`);
    });
  }

  // Description: join member associated data - appointments, recordings, notes, primary user, configuration,
  //              The aggregated data is being used to construct all spreadsheets
  async getMemberDataAggregate(): Promise<MemberDataAggregate[]> {
    return this.memberModel.aggregate([
      {
        // populate appointments for every member
        $lookup: {
          from: 'appointments',
          localField: '_id',
          foreignField: 'memberId',
          as: 'appointments',
        },
      },
      {
        // flatten appointments so we can access the notes `field` in appointments
        $unwind: {
          path: '$appointments',
        },
      },
      {
        // propagate notes data into the appointment document
        $lookup: {
          from: 'notes',
          localField: 'appointments.notes',
          foreignField: '_id',
          as: 'appointments.notesData',
        },
      },
      {
        // propagate recordings into the appointment document
        $lookup: {
          from: 'recordings',
          localField: 'appointments._id',
          foreignField: 'appointmentId',
          as: 'appointments.recordings',
        },
      },
      {
        // flatten notes data - make sure not to loose appointments without notes
        $unwind: {
          path: '$appointments.notesData',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        // group by id again and re-construct appointments per member
        $group: {
          _id: '$_id',
          appointments: {
            $push: '$appointments',
          },
        },
      },
      {
        // we lost the member data - need to load it again
        $lookup: {
          from: 'members',
          localField: '_id',
          foreignField: '_id',
          as: 'memberDetails',
        },
      },
      {
        $unwind: {
          path: '$memberDetails',
        },
      },
      {
        $lookup: {
          from: 'memberconfigs',
          localField: '_id',
          foreignField: 'memberId',
          as: 'memberConfig',
        },
      },
      {
        $unwind: {
          path: '$memberConfig',
        },
      },
      {
        $lookup: {
          from: 'users',
          localField: 'memberDetails.primaryUserId',
          foreignField: '_id',
          as: 'memberDetails.primaryUser',
        },
      },
      {
        $unwind: {
          path: '$memberDetails.primaryUser',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $lookup: {
          from: 'orgs',
          localField: 'memberDetails.org',
          foreignField: '_id',
          as: 'memberDetails.orgData',
        },
      },
      {
        $unwind: {
          path: '$memberDetails.orgData',
          preserveNullAndEmptyArrays: true,
        },
      },
      // { $allowDiskUse: true }, // "Analytics: error: got: MongoError: $allowDiskUse is not allowed in this atlas tier" :(
    ]);
  }

  async getCoachersDataAggregate(): Promise<CoachDataAggregate[]> {
    return this.userModel.aggregate([
      {
        // populate appointments for every member
        $lookup: {
          from: 'members',
          localField: '_id',
          foreignField: 'primaryUserId',
          as: 'members',
        },
      },
      {
        // flatten members
        $unwind: {
          path: '$members',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        // group by id again and re-construct appointments per member
        $group: {
          _id: '$_id',
          members: {
            $push: '$members',
          },
        },
      },
      {
        // re-insert user data
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user',
        },
      },
      {
        // flatten user data
        $unwind: {
          path: '$user',
        },
      },
    ]);
  }

  // Description: transform a member aggregated data to a calculated CSV entry representation (`members` sheet)
  async buildMemberData(member: MemberDataAggregate): Promise<MemberData> {
    const dcInstructionsLoadDate = await this.getDCFileLoadDate(
      member._id.toString(),
      member.memberDetails.firstName,
      member.memberDetails.lastName,
      InstructionsFileSuffix,
    );

    const dcSummaryLoadDate = await this.getDCFileLoadDate(
      member._id.toString(),
      member.memberDetails.firstName,
      member.memberDetails.lastName,
      SummaryFileSuffix,
    );

    const daysSinceDischarge = this.calculateDaysSinceDischarge(member.memberDetails.dischargeDate);

    const { firstActivationScore, lastActivationScore, firstWellbeingScore, lastWellbeingScore } =
      this.getActivationAndWellbeingStats(member.appointments);

    return {
      customer_id: member._id.toString(),
      mbr_initials: this.getMemberInitials({
        firstName: member.memberDetails.firstName,
        lastName: member.memberDetails.lastName,
      } as Member),
      first_name: member.memberDetails.firstName,
      last_name: member.memberDetails.lastName,
      honorific: member.memberDetails.honorific,
      dob: member.memberDetails.dateOfBirth,
      phone: member.memberDetails.phone,
      phone_secondary: member.memberDetails.phoneSecondary,
      email: member.memberDetails.email,
      readmission_risk: member.memberDetails.readmissionRisk,
      drg: member.memberDetails.drg,
      drg_desc: member.memberDetails.drgDesc,
      created: reformatDate(member.memberDetails.createdAt.toString(), DateTimeFormat),
      updated: reformatDate(member.memberDetails.updatedAt.toString(), DateTimeFormat),
      app_user:
        member.memberConfig &&
        (member.memberConfig?.platform === Platform.android ||
          member.memberConfig?.platform === Platform.ios),
      intervention_group: !member.isControlMember,
      language: member.memberConfig?.language,
      age: differenceInYears(this.getDateTime(), Date.parse(member.memberDetails.dateOfBirth)),
      race: member.memberDetails.race,
      ethnicity: member.memberDetails.ethnicity,
      gender: member.memberDetails.sex,
      street_address: member.memberDetails.address?.street,
      city: member.memberDetails.address?.city,
      state: member.memberDetails.address?.state,
      zip_code: member.memberDetails.zipCode,
      admit_date: member.memberDetails.admitDate
        ? reformatDate(member.memberDetails.admitDate, DateFormat)
        : undefined,
      discharge_date: member.memberDetails.dischargeDate
        ? reformatDate(member.memberDetails.dischargeDate, DateFormat)
        : undefined,
      los: this.calculateLos(member.memberDetails.admitDate, member.memberDetails.dischargeDate),
      days_since_discharge: daysSinceDischarge,
      active: daysSinceDischarge < GraduationPeriod,
      graduated: daysSinceDischarge >= GraduationPeriod,
      graduation_date: this.calculateGraduationDate(member.memberDetails.dischargeDate),
      dc_summary_load_date: dcSummaryLoadDate
        ? reformatDate(dcSummaryLoadDate.toString(), DateFormat)
        : undefined,
      dc_summary_received: !!dcSummaryLoadDate,
      dc_instructions_load_date: dcInstructionsLoadDate
        ? reformatDate(dcInstructionsLoadDate.toString(), DateFormat)
        : undefined,
      dc_instructions_received: !!dcInstructionsLoadDate,
      first_activation_score: firstActivationScore,
      last_activation_score: lastActivationScore,
      first_wellbeing_score: firstWellbeingScore,
      last_wellbeing_score: lastWellbeingScore,
      fellow: member.memberDetails.fellowName,
      harmony_link: !member.isControlMember
        ? `${HarmonyLink}/details/${member._id.toString()}`
        : undefined,
      platform: member.memberConfig?.platform,
      app_first_login:
        member.memberConfig?.firstLoggedInAt &&
        reformatDate(member.memberConfig.firstLoggedInAt.toString(), DateTimeFormat),
      app_last_login:
        member.memberConfig &&
        reformatDate(member.memberConfig.updatedAt.toString(), DateTimeFormat),
      org_name: member.memberDetails.orgData?.name,
      org_id: member.memberDetails.orgData?._id.toString(),
      // eslint-disable-next-line max-len
      coach_name: member.memberDetails.primaryUser
        ? // eslint-disable-next-line max-len
          `${member.memberDetails.primaryUser.firstName} ${member.memberDetails.primaryUser.lastName}`
        : undefined,
      coach_id: member.memberDetails.primaryUserId?.toString(),
    };
  }

  // Description: transform a coach aggregated data to a calculated CSV entry representation (`coach` sheet)
  buildCoachData(data: CoachDataAggregate): CoachData {
    return {
      created: reformatDate(data.user.createdAt.toString(), DateTimeFormat),
      user_id: data._id.toString(),
      first_name: data.user.firstName,
      last_name: data.user.lastName,
      roles: data.user.roles,
      title: data.user.title,
      phone: data.user.phone,
      email: data.user.email,
      spanish: data.user.languages?.includes(Language.es),
      bio: data.user.description,
      avatar: data.user.avatar,
      max_members: data.user.maxCustomers,
      assigned_members: this.getNonGraduatedMembers(data.members),
    };
  }

  getNonGraduatedMembers(members: BaseMember[]): string[] {
    // TODO: filter out graduated members
    return members
      .filter((member) => !this.isGraduated(member.dischargeDate))
      .map((member) => member._id.toString());
  }

  // Description: transform a member aggregated data to a calculated CSV entry representation (`appointments` sheet)
  buildAppointmentsMemberData(member: MemberDataAggregate): AppointmentsMemberData[] {
    // Member/General details: calculated once for all entries
    const created = reformatDate(member.memberDetails.createdAt.toString(), DateFormat);
    const customer_id = member._id.toString();
    const mbr_initials = this.getMemberInitials({
      firstName: member.memberDetails.firstName,
      lastName: member.memberDetails.lastName,
    } as Member);
    const daysSinceDischarge = this.calculateDaysSinceDischarge(member.memberDetails.dischargeDate);
    const harmony_link = !member.isControlMember
      ? `${HarmonyLink}/details/${member._id.toString()}`
      : undefined;
    // eslint-disable-next-line max-len
    const graduation_date = this.calculateGraduationDate(member.memberDetails.dischargeDate);
    const results = [];

    // load appointment 0: (according to example excel spreadsheet we have appointment 0 also for engaged members)
    results.push({
      created,
      customer_id: member._id.toString(),
      mbr_initials,
      appt_number: 0,
      graduated: this.isGraduated(member.memberDetails.dischargeDate),
      graduation_date,
    });

    let count = 0;
    member?.appointments
      ?.filter((appointment) => appointment.start) // TODO: confirm with Alex: requested appointments will not be listed (no start date)
      .sort((a, b) => {
        if (a.noShow) {
          // the no-show (`missed_appt===TRUE`) are listed first
          return -1;
        }
        return differenceInDays(a.start, b.start);
      })
      .forEach((appointment) => {
        if (!appointment.noShow) {
          count++;
        }

        const startDateTime =
          appointment.status !== AppointmentStatus.requested ? appointment.start : undefined;

        const recordingsSummary = this.getRecordingsSummary(appointment.recordings);

        results.push({
          created: reformatDate(appointment?.start?.toString(), DateTimeFormat),
          updated: reformatDate(appointment?.updatedAt?.toString(), DateTimeFormat),
          recap: appointment?.notesData?.recap,
          strengths: appointment?.notesData?.strengths,
          member_plan: appointment?.notesData?.memberActionItem,
          coach_plan: appointment?.notesData?.userActionItem,
          activation_score: appointment?.notesData?.scores?.adherence,
          activation_reason: appointment?.notesData?.scores?.adherenceText,
          wellbeing_score: appointment?.notesData?.scores?.wellbeing,
          wellbeing_reason: appointment?.notesData?.scores?.wellbeingText,
          recorded_consent: appointment?.recordingConsent,
          customer_id,
          mbr_initials,
          appt_number: appointment.noShow ? undefined : count,
          chat_id: appointment._id.toString(), // TODO: check with Alex where we get the chat_id - for now we set to appointment id
          appt_date: reformatDate(startDateTime.toString(), DateFormat),
          appt_time_ct: reformatDate(startDateTime.toString(), TimeFormat),
          appt_status: this.getAppointmentsStatus(appointment.status, appointment.noShow),
          appt_day_of_week_name: reformatDate(startDateTime.toString(), DayOfWeekFormat),
          appt_hour: reformatDate(startDateTime.toString(), HourFormat),
          status: appointment.status,
          missed_appt: this.getAppointmentsMissedIndication(appointment.status, appointment.noShow),
          total_duration: recordingsSummary.totalDuration,
          total_outreach_attempts: appointment.recordings?.length || 0,
          channel_primary: recordingsSummary.primaryChannel,
          event_type_primary: undefined, // TODO: confirm with Alex how to determine primary event
          graduated: daysSinceDischarge >= GraduationPeriod,
          graduation_date,
          is_video_call: appointment.method === AppointmentMethod.videoCall,
          is_phone_call: appointment.method === AppointmentMethod.phoneCall,
          harmony_link,
          coach_name: this.userData?.get(appointment.userId.toString()),
          coach_id: appointment.userId.toString(),
        });
      });

    return results;
  }

  // Description: determine appointments status - attended? / scheduled? / missed?
  getAppointmentsStatus(status: AppointmentStatus, noShow: boolean): AppointmentAttendanceStatus {
    if (noShow) {
      return AppointmentAttendanceStatus.missed;
    }
    if (status === AppointmentStatus.done) {
      return AppointmentAttendanceStatus.attended;
    }
    if (status === AppointmentStatus.scheduled) {
      return AppointmentAttendanceStatus.scheduled;
    }
    if (status === AppointmentStatus.requested) {
      return AppointmentAttendanceStatus.requested;
    }
  }

  // Description: determine a missed label for the appointment
  // Note: since this value might be set to null we can not use boolean
  getAppointmentsMissedIndication(status: AppointmentStatus, noShow: boolean): string {
    if (noShow) {
      return 'TRUE';
    }
    if (status === AppointmentStatus.done) {
      return 'FALSE';
    }
    if (status === AppointmentStatus.scheduled) {
      return ''; // missed label can not be determined
    }
  }

  // Description: collect recording stats - determine total duration,
  //              primary channel used for communication and total outreach attempts
  getRecordingsSummary(recordings: Recording[]): RecordingSummary {
    let totalDuration = 0;
    let primaryChannel: RecordingType;

    const channelTotalDuration: { [recordingType: string]: number } = {};

    Object.keys(RecordingType).forEach((type) => {
      channelTotalDuration[type] = 0;
    });

    recordings?.forEach((entry) => {
      let duration = 0;
      if (entry.end && entry.start) {
        duration = differenceInSeconds(entry.end, entry.start);

        totalDuration += entry.answered ? duration : 0;
      }

      switch (entry.recordingType) {
        case RecordingType.video:
          channelTotalDuration[RecordingType.video] += duration;
          break;
        case RecordingType.voip:
          channelTotalDuration[RecordingType.voip] += duration;
          break;
        case RecordingType.phone:
          channelTotalDuration[RecordingType.phone] += duration;
          break;
      }
    });

    if (totalDuration > 0) {
      // Determine primary channel based on total duration per channel
      primaryChannel = RecordingType.phone;
      if (channelTotalDuration[RecordingType.phone] < channelTotalDuration[RecordingType.voip]) {
        primaryChannel = RecordingType.voip;
      }
      if (channelTotalDuration[RecordingType.voip] < channelTotalDuration[RecordingType.video]) {
        primaryChannel = RecordingType.video;
      }
    }

    return { primaryChannel, totalDuration };
  }

  // Description: get discharge notes (by type) from S3 - this is to determine if files were loaded to member
  async getDCFileLoadDate(
    memberId: string,
    firstName: string,
    lastName: string,
    type: string,
  ): Promise<Date | null> {
    return this.storageService.getDocumentLastModified(
      `public/${StorageType.documents}/${memberId}/${firstName}_${lastName}_${type}.pdf`,
    );
  }
  // Description: calculated Length of stay based on admission admit data and discharge date
  calculateLos(admitDate: string, dischargeDate: string): number {
    if (admitDate && dischargeDate) {
      return differenceInDays(Date.parse(dischargeDate), Date.parse(admitDate));
    }
  }

  // Description: calculated days since discharge (we can determine graduation based on this)
  calculateDaysSinceDischarge(dischargeDate: string): number {
    if (dischargeDate) {
      return differenceInDays(this.getDateTime(), Date.parse(dischargeDate));
    }
  }

  // Description: calculated graduation date for discharge date
  calculateGraduationDate(dischargeDate: string): string {
    if (dischargeDate) {
      return reformatDate(
        add(Date.parse(dischargeDate), { days: GraduationPeriod }).toString(),
        DateFormat,
      );
    }
  }

  // Description: from all completed / summarized appointments where notes exists pick the first and last scores for activation and wellbeing
  getActivationAndWellbeingStats(appointments: PopulatedAppointment[]): {
    firstActivationScore: number;
    lastActivationScore: number;
    firstWellbeingScore: number;
    lastWellbeingScore: number;
  } {
    let firstActivationScore;
    let lastActivationScore;
    let firstWellbeingScore;
    let lastWellbeingScore;

    appointments
      ?.filter((a) => a.start && a.end && a.notesData)
      .sort((a, b) => {
        return differenceInDays(a.start, b.start);
      })
      .forEach((appointment) => {
        firstActivationScore ??= appointment.notesData.scores?.adherence;
        lastActivationScore = appointment.notesData.scores?.adherence;
        firstWellbeingScore ??= appointment.notesData.scores?.wellbeing;
        lastWellbeingScore = appointment.notesData.scores?.wellbeing;
      });
    return {
      firstActivationScore,
      lastActivationScore,
      firstWellbeingScore,
      lastWellbeingScore,
    };
  }

  // Description: a mockable date-time getter
  getDateTime(): number {
    return Date.now();
  }

  getMemberInitials(member: Member): string {
    return member.firstName[0].toUpperCase() + member.lastName[0].toUpperCase();
  }

  isGraduated(dischargeDate: string): boolean {
    return this.calculateDaysSinceDischarge(dischargeDate) >= GraduationPeriod;
  }

  dumpCSV(outFileName: string, sheetName: SheetOption, timestamp: number, data: any[]) {
    json2csv(
      data,
      (err, csv) => {
        if (err) {
          throw err;
        } else {
          fs.writeFileSync(
            `${outFileName}/${timestamp}.${sheetName}.${
              process.env.NODE_ENV ? process.env.NODE_ENV : 'test'
            }.csv`,
            csv,
          );
        }
      },
      { emptyFieldValue: 'null' },
    );
  }

  writeToFile(outFileName: string, sheetName: SheetOption, timestamp: number, data: any[]) {
    fs.writeFile(
      `${outFileName}/${timestamp}.${sheetName}.${
        process.env.NODE_ENV ? process.env.NODE_ENV : 'test'
      }.json`,
      JSON.stringify(data),
      (err) => {
        if (err) {
          throw err;
        }
      },
    );
  }
}
