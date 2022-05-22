import { Language, Platform, StorageType } from '@argus/pandora';
import { Injectable } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { differenceInDays, differenceInSeconds, differenceInYears } from 'date-fns';
import { writeFile, writeFileSync } from 'fs';
import { json2csv } from 'json-2-csv';
import { omit } from 'lodash';
import { Connection, Model, Types } from 'mongoose';
import {
  AnalyticsData,
  AnalyticsDataAggregate,
  AppointmentAttendanceStatus,
  AppointmentsMemberData,
  BarrierData,
  BarrierTypeData,
  BaseCareData,
  BaseMember,
  CarePlanData,
  CarePlanTypeData,
  CaregiverData,
  CoachData,
  CoachDataAggregate,
  GraduationPeriod,
  HarmonyLink,
  InstructionsFileSuffix,
  MemberData,
  MemberDataAggregate,
  PopulatedAppointment,
  PopulatedMember,
  QuestionnaireResponseData,
  QuestionnaireResponseWithTimestamp,
  RecordingSummary,
  RedFlagData,
  RedFlagTypeData,
  SheetOption,
  SummaryFileSuffix,
} from '.';
import { RecordingType, momentFormats, reformatDate } from '../../src/common';
import {
  CaregiverDocument,
  Member,
  MemberDocument,
  MemberService,
  Recording,
} from '../../src/member';
import { StorageService } from '../../src/providers';
import {
  Questionnaire,
  QuestionnaireDocument,
  QuestionnaireResponse,
  QuestionnaireResponseDocument,
} from '../../src/questionnaire';
import {
  AppointmentMethod,
  AppointmentStatus,
  Barrier,
  BarrierType,
  BaseCare,
  CarePlan,
  CarePlanType,
  Caregiver,
  User,
} from '@argus/hepiusClient';
import { UserDocument } from '../../src/user';
import {
  BarrierDocument,
  BarrierTypeDocument,
  CarePlanDocument,
  CarePlanTypeDocument,
  RedFlag,
  RedFlagDocument,
  RedFlagType,
  RedFlagTypeDocument,
} from '../../src/care';

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
    @InjectModel(Caregiver.name)
    private readonly caregiverModel: Model<CaregiverDocument>,
    @InjectModel(QuestionnaireResponse.name)
    private readonly questionnaireResponseModel: Model<QuestionnaireResponseDocument>,
    @InjectModel(Questionnaire.name)
    private readonly questionnaireModel: Model<QuestionnaireDocument>,
    @InjectModel(Barrier.name)
    private readonly barrierModel: Model<BarrierDocument>,
    @InjectModel(BarrierType.name)
    private readonly barrierTypeModel: Model<BarrierTypeDocument>,
    @InjectModel(RedFlagType.name)
    private readonly redFlagTypeModel: Model<RedFlagTypeDocument>,
    @InjectModel(RedFlag.name)
    private readonly redFlagModel: Model<RedFlagDocument>,
    @InjectModel(CarePlanType.name)
    private readonly carePlanTypeModel: Model<CarePlanTypeDocument>,
    @InjectModel(CarePlan.name)
    private readonly carePlanModel: Model<CarePlanDocument>,
  ) {}

  private userData: Map<string, string>;
  private questionnaireData: Map<string, string>;

  async init() {
    // upload users - full name is required for the appointment entry
    await this.uploadUserData();
    await this.uploadQuestionnaireData();
  }

  async clean() {
    await this.connection.close();
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

  async uploadQuestionnaireData(): Promise<void> {
    this.questionnaireData = new Map<string, string>();

    const questionnaires = await this.questionnaireModel.find({}, { _id: 1, type: 1 });

    questionnaires.forEach((questionnaire) => {
      this.questionnaireData.set(questionnaire._id.toString(), questionnaire.type);
    });
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
          from: 'journeys',
          localField: '_id',
          foreignField: 'memberId',
          as: 'journeysRes',
        },
      },
      { $sort: { 'journeysRes._id': -1 } },
      { $addFields: { recentJourney: { $first: '$journeysRes' } } },
      { $unset: 'journeysRes' },
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
          as: 'memberDetails.org',
        },
      },
      {
        $unwind: {
          path: '$memberDetails.org',
          preserveNullAndEmptyArrays: true,
        },
      },
      // { $allowDiskUse: true }, // "Analytics: error: got: MongoError: $allowDiskUse is not allowed in this atlas tier" :(
    ]);
  }

  async getCaregiversData(): Promise<CaregiverData[]> {
    const caregivers: (CaregiverDocument & { createdAt: Date; updatedAt: Date })[] =
      await this.caregiverModel.find().lean();

    const caregiverDataArray = [];
    if (caregivers) {
      caregivers?.forEach((caregiver) => {
        const caregiverData = new CaregiverData();
        Object.assign(
          caregiverData,
          omit(
            {
              ...caregiver,
              id: caregiver._id.toString(),
              memberId: caregiver.memberId.toString(),
              created: reformatDate(caregiver.createdAt?.toString(), momentFormats.mysqlDateTime),
            },
            ['_id'],
          ),
        );
        caregiverDataArray.push(caregiverData);
      });

      return caregiverDataArray;
    }
  }

  async getQuestionnaireResponseData(): Promise<QuestionnaireResponseData[]> {
    const qrs: QuestionnaireResponseWithTimestamp[] = await this.questionnaireResponseModel.find();

    const qrDataSet = [];
    if (qrs) {
      qrs.forEach((qr) => {
        qr.answers?.forEach((answer) => {
          const qrData = new QuestionnaireResponseData();
          qrData.member_id = qr.memberId.toString();
          qrData.qr_id = qr._id.toString();
          qrData.questionnaire_id = qr.questionnaireId.toString();
          qrData.questionnaire_type = this.questionnaireData.get(qrData.questionnaire_id);
          qrData.answer_code = answer.code;
          qrData.answer_value = answer.value;
          qrData.created = reformatDate(qr.createdAt?.toString(), momentFormats.mysqlDateTime);
          qrDataSet.push(qrData);
        });
      });
    }

    return qrDataSet;
  }

  async getBarrierTypesData(): Promise<BarrierTypeData[]> {
    const barrierTypes: BarrierType[] = await this.barrierTypeModel.find();
    return barrierTypes.map((input: BarrierType) => {
      const barrierType = new BarrierTypeData();
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      barrierType.id = input._id.toString();
      barrierType.description = input.description;
      barrierType.domain = input.domain;
      barrierType.carePlanTypes = input.carePlanTypes.map((item) => item.toString());
      return barrierType;
    });
  }

  async getBarriersData(): Promise<BarrierData[]> {
    const barriers: Barrier[] = await this.barrierModel.find();

    return barriers.map((input: Barrier) => {
      const barrier = new BarrierData();
      this.initBaseFields(barrier, input);
      barrier.type = input.type.toString();
      barrier.redFlagId = input.redFlagId.toString();
      return barrier;
    });
  }

  async getRedFlagTypeData(): Promise<RedFlagType[]> {
    const redFlagTypes: RedFlagType[] = await this.redFlagTypeModel.find();

    return redFlagTypes.map((input: RedFlagType) => {
      const redFlagType = new RedFlagTypeData();
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      redFlagType.id = input._id.toString();
      redFlagType.description = input.description;
      return redFlagType;
    });
  }

  async getRedFlagData(): Promise<RedFlagData[]> {
    const redFlags: RedFlag[] = await this.redFlagModel.find();

    return redFlags.map((input: RedFlag) => {
      const redFlag = new RedFlagData();
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      redFlag.id = input._id.toString();
      redFlag.member_id = input.memberId.toString();
      redFlag.created = reformatDate(input.createdAt.toString(), momentFormats.mysqlDateTime);
      redFlag.updated = reformatDate(input.updatedAt.toString(), momentFormats.mysqlDateTime);
      redFlag.type = input.type.toString();
      redFlag.notes = input.notes;
      return redFlag;
    });
  }

  async getCarePlanTypesData(): Promise<CarePlanTypeData[]> {
    const carePlanTypes: CarePlanType[] = await this.carePlanTypeModel.find();
    return carePlanTypes.map((input: CarePlanType) => {
      const carePlanType = new CarePlanTypeData();
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      carePlanType.id = input._id.toString();
      carePlanType.description = input.description;
      carePlanType.isCustom = input.isCustom;
      return carePlanType;
    });
  }

  async getCarePlansData(): Promise<CarePlanData[]> {
    const carePlans: CarePlan[] = await this.carePlanModel.find();

    return carePlans.map((input: CarePlan) => {
      const carePlan = new CarePlanData();
      this.initBaseFields(carePlan, input);
      carePlan.type = input.type.toString();
      carePlan.barrierId = input.barrierId?.toString();
      carePlan.dueDate = reformatDate(input.dueDate?.toString(), momentFormats.mysqlDateTime);
      return carePlan;
    });
  }

  private initBaseFields(data: BaseCareData, baseCare: BaseCare): BaseCareData {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    data.id = baseCare._id.toString();
    data.member_id = baseCare.memberId.toString();
    data.created = reformatDate(baseCare.createdAt.toString(), momentFormats.mysqlDateTime);
    data.updated = reformatDate(baseCare.updatedAt.toString(), momentFormats.mysqlDateTime);
    data.status = baseCare.status;
    data.notes = baseCare.notes;
    data.completed = reformatDate(baseCare.completedAt?.toString(), momentFormats.mysqlDateTime);
    return data;
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

    const { deceased } = member.memberDetails;

    return {
      customer_id: member._id.toString(),
      mbr_initials: this.getMemberInitials({
        firstName: member.memberDetails.firstName,
        lastName: member.memberDetails.lastName,
      } as Member),
      first_name: member.memberDetails.firstName,
      last_name: member.memberDetails.lastName,
      honorific: member.memberDetails.honorific,
      dob: reformatDate(member.memberDetails.dateOfBirth, momentFormats.mysqlDate),
      phone: member.memberDetails.phone,
      phone_secondary: member.memberDetails.phoneSecondary,
      email: member.memberDetails.email,
      readmission_risk: member.memberDetails.readmissionRisk,
      drg: member.memberDetails.drg,
      drg_desc: member.memberDetails.drgDesc,
      created: reformatDate(member.memberDetails.createdAt.toString(), momentFormats.mysqlDateTime),
      updated: reformatDate(member.memberDetails.updatedAt.toString(), momentFormats.mysqlDateTime),
      app_user:
        member.memberConfig &&
        (member.memberConfig?.platform === Platform.android ||
          member.memberConfig?.platform === Platform.ios),
      intervention_group: !member.isControlMember,
      language: member.memberConfig?.language,
      age: differenceInYears(this.getDateTime(), Date.parse(member.memberDetails.dateOfBirth)),
      race: member.memberDetails.race,
      gender: member.memberDetails.sex,
      street_address: member.memberDetails.address?.street,
      city: member.memberDetails.address?.city,
      state: member.memberDetails.address?.state,
      zip_code: member.memberDetails.zipCode,
      admit_date: member.memberDetails.admitDate
        ? reformatDate(member.memberDetails.admitDate, momentFormats.mysqlDate)
        : undefined,
      discharge_date: member.memberDetails.dischargeDate
        ? reformatDate(member.memberDetails.dischargeDate, momentFormats.mysqlDate)
        : undefined,
      los: this.calculateLos(member.memberDetails.admitDate, member.memberDetails.dischargeDate),
      days_since_discharge: differenceInDays(
        new Date(),
        Date.parse(member.memberDetails.dischargeDate),
      ),
      active: daysSinceDischarge < GraduationPeriod,
      graduated: member.recentJourney.isGraduated,
      graduation_date:
        member.recentJourney.graduationDate &&
        reformatDate(member.recentJourney.graduationDate.toString(), momentFormats.mysqlDate),
      dc_summary_load_date: dcSummaryLoadDate
        ? reformatDate(dcSummaryLoadDate.toString(), momentFormats.mysqlDate)
        : undefined,
      dc_summary_received: !!dcSummaryLoadDate,
      dc_instructions_load_date: dcInstructionsLoadDate
        ? reformatDate(dcInstructionsLoadDate.toString(), momentFormats.mysqlDate)
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
        member.recentJourney?.firstLoggedInAt &&
        reformatDate(member.recentJourney.firstLoggedInAt.toString(), momentFormats.mysqlDateTime),
      app_last_login:
        member.recentJourney?.lastLoggedInAt &&
        reformatDate(member.recentJourney.lastLoggedInAt.toString(), momentFormats.mysqlDateTime),
      org_name: member.memberDetails.org?.name,
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      //@ts-ignore
      org_id: member.memberDetails.org?._id.toString(),
      // eslint-disable-next-line max-len
      coach_name: member.memberDetails.primaryUser
        ? // eslint-disable-next-line max-len
          `${member.memberDetails.primaryUser.firstName} ${member.memberDetails.primaryUser.lastName}`
        : undefined,
      coach_id: member.memberDetails.primaryUserId?.toString(),
      general_notes: member.recentJourney.generalNotes,
      nurse_notes: member.recentJourney.nurseNotes,
      marital_status: member.memberDetails.maritalStatus,
      height: member.memberDetails.height,
      weight: member.memberDetails.weight,
      deceased_cause: deceased ? deceased.cause : undefined,
      deceased_date: deceased
        ? reformatDate(deceased.date.toString(), momentFormats.mysqlDateTime)
        : undefined,
      deceased_days_from_dc:
        deceased && member.memberDetails?.dischargeDate
          ? differenceInDays(
              Date.parse(deceased.date),
              Date.parse(member.memberDetails.dischargeDate),
            )
          : undefined,
      deceased_flag: !!deceased,
    };
  }

  // Description: transform a coach aggregated data to a calculated CSV entry representation (`coach` sheet)
  buildCoachData(data: CoachDataAggregate): CoachData {
    return {
      created: reformatDate(data.user.createdAt.toString(), momentFormats.mysqlDateTime),
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
      max_members: data.user.maxMembers,
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
    const created = reformatDate(
      member.memberDetails.createdAt.toString(),
      momentFormats.mysqlDate,
    );
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
    const graduation_date =
      member.recentJourney.graduationDate &&
      reformatDate(member.recentJourney.graduationDate.toString(), momentFormats.mysqlDate);
    const results = [];

    // load appointment 0: (according to example excel spreadsheet we have appointment 0 also for engaged members)
    results.push({
      created,
      customer_id: member._id.toString(),
      mbr_initials,
      appt_number: 0,
      graduated: member.recentJourney.isGraduated,
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
          created: reformatDate(appointment?.createdAt?.toString(), momentFormats.mysqlDateTime),
          updated: reformatDate(appointment?.updatedAt?.toString(), momentFormats.mysqlDateTime),
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
          chat_id: appointment._id.toString(),
          appt_date: reformatDate(startDateTime.toString(), momentFormats.mysqlDate),
          appt_time_ct: reformatDate(startDateTime.toString(), momentFormats.time),
          appt_status: this.getAppointmentsStatus(appointment.status, appointment.noShow),
          appt_day_of_week_name: reformatDate(startDateTime.toString(), momentFormats.dayOfWeek),
          appt_hour: reformatDate(startDateTime.toString(), momentFormats.hour),
          status: appointment.status,
          missed_appt: appointment.noShow,
          no_show_reason: appointment.noShowReason,
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

  dumpCSV(outFileName: string, sheetName: SheetOption, timestamp: number, data: AnalyticsData[]) {
    json2csv(
      data,
      (err, csv) => {
        if (err) {
          throw err;
        } else {
          writeFileSync(
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

  writeToFile(
    outFileName: string,
    sheetName: SheetOption,
    timestamp: number,
    data: AnalyticsDataAggregate[],
  ) {
    writeFile(
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
