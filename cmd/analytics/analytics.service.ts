import { Platform } from '@lagunahealth/pandora';
import { AppointmentStatus, RecordingType, StorageType, reformatDate } from '../../src/common';
import {
  AppointmentAttendanceStatus,
  AppointmentsMemberData,
  DateFormat,
  DayOfWeekFormat,
  GraduationPeriod,
  HarmonyLink,
  HourFormat,
  InstructionsFileSuffix,
  MemberData,
  MemberDataAggregate,
  PopulatedAppointment,
  RecordingSummary,
  SummaryFileSuffix,
  TimeFormat,
} from './analytics.dto';
import { add, differenceInDays, differenceInSeconds, differenceInYears } from 'date-fns';
import { Injectable } from '@nestjs/common';
import { AppointmentMethod } from '../../src/appointment';
import { Member, MemberDocument, MemberService, Recording } from '../../src/member';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model } from 'mongoose';
import { StorageService } from '../../src/providers';

@Injectable()
export class AnalyticsService {
  constructor(
    private readonly memberService: MemberService,
    @InjectModel(Member.name)
    private readonly memberModel: Model<MemberDocument>,
    private readonly storageService: StorageService,
    @InjectConnection() private connection: Connection,
  ) {}

  async clean() {
    this.connection.close();
  }

  // Description: get all control members
  async getAllControl(): Promise<MemberDocument[]> {
    return this.memberService.getAllControl();
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
        // propagate notes into the appointment document
        $lookup: {
          from: 'notes',
          localField: 'appointments.notes',
          foreignField: '_id',
          as: 'appointments.note',
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
        // flatten notes - make sure not to loose appointments without notes
        $unwind: {
          path: '$appointments.note',
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
      // { $allowDiskUse: true }, // "Analytics: error: got: MongoError: $allowDiskUse is not allowed in this atlas tier" :(
    ]);
  }

  // Description: since our control members located in a separate collection and
  // we have a separate (simple) find query to get all members
  async getControlMemberData(members: MemberDocument[]): Promise<MemberData[]> {
    return members.map((member) => {
      return {
        customer_id: member._id.toString(),
        mbr_initials: this.getMemberInitials({
          firstName: member.firstName,
          lastName: member.lastName,
        } as Member),
        created: reformatDate(member.createdAt.toString(), DateFormat),
        intervention_group: false, // control member is, by definition, not in intervention group
        language: member.language,
        age: differenceInYears(this.getDateTime(), Date.parse(member.dateOfBirth)),
        race: member.race,
        ethnicity: member.ethnicity,
        gender: member.sex,
        street_address: member.address?.street,
        city: member.address?.city,
        state: member.address?.state,
        zip_code: member.zipCode,
      } as MemberData;
    });
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
      created: reformatDate(member.memberDetails.createdAt.toString(), DateFormat),
      app_user:
        member.memberConfig.platform === Platform.android ||
        member.memberConfig.platform === Platform.ios,
      intervention_group: true,
      language: member.memberDetails.language,
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
        : '',
      discharge_date: member.memberDetails.dischargeDate
        ? reformatDate(member.memberDetails.dischargeDate, DateFormat)
        : '',
      los: this.calculateLos(member.memberDetails.admitDate, member.memberDetails.dischargeDate),
      days_since_discharge: daysSinceDischarge,
      active: daysSinceDischarge < GraduationPeriod,
      graduated: daysSinceDischarge >= GraduationPeriod,
      graduation_date: this.calculateGraduationDate(member.memberDetails.dischargeDate),
      dc_summary_load_date: dcSummaryLoadDate
        ? reformatDate(dcSummaryLoadDate.toString(), DateFormat)
        : '',
      dc_summary_received: !!dcSummaryLoadDate,
      dc_instructions_load_date: dcInstructionsLoadDate
        ? reformatDate(dcInstructionsLoadDate.toString(), DateFormat)
        : '',
      dc_instructions_received: !!dcInstructionsLoadDate,
      first_activation_score: firstActivationScore,
      last_activation_score: lastActivationScore,
      first_wellbeing_score: firstWellbeingScore,
      last_wellbeing_score: lastWellbeingScore,
      fellow: member.memberDetails.fellowName,
      harmony_link: `${HarmonyLink}/details/${member._id.toString()}`,
      // eslint-disable-next-line max-len
      coach_name: `${member.memberDetails.primaryUser.firstName} ${member.memberDetails.primaryUser.lastName}`,
    };
  }

  // Description: transform a member aggregated data to a calculated CSV entry representation (`appointments` sheet)
  async buildAppointmentsMemberData(
    member: MemberDataAggregate,
  ): Promise<AppointmentsMemberData[]> {
    // Member/General details: calculated once for all entries
    const created = reformatDate(member.memberDetails.createdAt.toString(), DateFormat);
    const customer_id = member._id.toString();
    const mbr_initials = this.getMemberInitials({
      firstName: member.memberDetails.firstName,
      lastName: member.memberDetails.lastName,
    } as Member);
    const daysSinceDischarge = this.calculateDaysSinceDischarge(member.memberDetails.dischargeDate);
    const harmony_link = `${HarmonyLink}/details/${member._id.toString()}`;
    // eslint-disable-next-line max-len
    const coach_name = `${member.memberDetails.primaryUser.firstName} ${member.memberDetails.primaryUser.lastName}`;
    const graduation_date = this.calculateGraduationDate(member.memberDetails.dischargeDate);
    const results = [];

    // load appointment 0: (according to example excel spreadsheet we have appointment 0 also for engaged members)
    results.push({
      created: reformatDate(member.memberDetails.createdAt.toString(), DateFormat),
      customer_id: member._id.toString(),
      mbr_initials,
      appt_number: 0,
      graduated: daysSinceDischarge >= GraduationPeriod,
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
          created,
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
          total_outreach_attempts: recordingsSummary.totalOutreachAttempts, // TODO: Placeholder: Alex confirmed that this is not required in initial version
          channel_primary: recordingsSummary.primaryChannel,
          event_type_primary: undefined, // TODO: confirm with Alex how to determine primary event
          graduated: daysSinceDischarge >= GraduationPeriod,
          graduation_date,
          is_video_call: appointment.method === AppointmentMethod.videoCall,
          is_phone_call: appointment.method === AppointmentMethod.phoneCall,
          harmony_link,
          coach_name,
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
    let totalOutreachAttempts = 0;
    let primaryChannel: RecordingType;

    const channelTotalDuration: { [recordingType: string]: number } = {};

    Object.keys(RecordingType).forEach((type) => {
      channelTotalDuration[type] = 0;
    });

    recordings?.forEach((entry) => {
      let duration = 0;
      if (entry.end && entry.start) {
        duration = differenceInSeconds(entry.end, entry.start);
      }
      if (entry.answered) {
        totalDuration += duration;
      } else {
        totalOutreachAttempts++;
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

    return { primaryChannel, totalDuration, totalOutreachAttempts };
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
      .filter((a) => a.start && a.end && a.note)
      .sort((a, b) => {
        return differenceInDays(a.start, b.start);
      })
      .forEach((appointment) => {
        if (firstActivationScore === undefined) {
          firstActivationScore = appointment.note.scores?.adherence;
        }
        lastActivationScore = appointment.note.scores?.adherence;

        if (firstWellbeingScore === undefined) {
          firstWellbeingScore = appointment.note.scores?.wellbeing;
        }
        lastWellbeingScore = appointment.note.scores?.wellbeing;
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
}
