import { Language, Platform } from '@argus/pandora';
import { QuestionnaireResponseDocument } from '../../src/questionnaire';
import { hosts } from 'config';
import { Types } from 'mongoose';
import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { RecordingType } from '../../src/common';
import { Honorific, MaritalStatus, Member, MemberConfig, Race, Sex } from '../../src/member';
import { Journey, ReadmissionRisk } from '../../src/journey';
import {
  Appointment,
  AppointmentStatus,
  BarrierDomain,
  BarrierStatus,
  CarePlanStatus,
  Notes,
  Relationship,
  User,
  UserRole,
} from '@argus/hepiusClient';
import { Recording } from '../../src/recording';

export const DefaultOutputDir = './outputs';
export const HarmonyLink = hosts.harmony;
export const InstructionsFileSuffix = 'Instructions';
export const SummaryFileSuffix = 'Summary';
export const GraduationPeriod = 90;

export const MemberTable = 'harmony_member';
export const CoachTable = 'harmony_coach';
export const CaregiverTable = 'harmony_caregiver';
export const AppointmentTable = 'harmony_appts';
export const QuestionnaireResponseTable = 'harmony_qrs';
export const BarrierTable = 'harmony_barriers';
export const BarrierTypeTable = 'harmony_barrier_types';
export const RedFlagTypeTable = 'harmony_red_flag_type';
export const RedFlagTable = 'harmony_red_flag';
export const CarePlanTypeTable = 'harmony_care_plan_type';
export const CarePlanTable = 'harmony_care_plan';

export enum SheetOption {
  members = 'members',
  appointments = 'appointments',
  coachers = 'coachers',
  caregivers = 'caregivers',
  qrs = 'qrs',
  barriers = 'barriers',
  redflags = 'redflags',
  careplans = 'careplans',
  all = 'all',
}

export enum AppointmentAttendanceStatus {
  missed = 'missed',
  attended = 'attended',
  scheduled = 'scheduled',
  requested = 'requested',
}
export enum AppointmentsEventType {
  outbound_voip = 'outbound_voip',
  phone_call = 'phone_call',
  video_call = 'video_call',
}

// MemberData represent the Analytics `members` expected spreadsheet columns list
@Entity({ name: MemberTable })
export class MemberData {
  @PrimaryColumn('varchar', { length: 50 })
  customer_id: string;
  @Column('varchar', { length: 3 })
  mbr_initials: string;
  @Column('varchar', { length: 50 })
  first_name: string;
  @Column('varchar', { length: 50 })
  last_name: string;
  @Column('varchar', { length: 20 })
  honorific: Honorific;
  @Column('date')
  dob: string;
  @Column('varchar', { length: 15 })
  phone: string;
  @Column('varchar', { length: 15, nullable: true })
  phone_secondary?: string;
  @Column('varchar', { length: 100, nullable: true })
  email?: string;
  @Column('varchar', { length: 10, nullable: true })
  readmission_risk?: ReadmissionRisk;
  @Column('varchar', { length: 100, nullable: true })
  drg?: string;
  @Column('varchar', { length: 100, nullable: true })
  drg_desc?: string;
  @Column('datetime', { nullable: true })
  created: string;
  @Column('datetime', { nullable: true })
  updated: string;
  @Column('varchar', { length: 100, nullable: true })
  platform?: Platform;
  @Column('float', { nullable: true })
  app_user: boolean; // is member using Laguna app?
  @Column('datetime', { nullable: true })
  app_first_login?: string;
  @Column('datetime', { nullable: true })
  app_last_login?: string;
  @Column('float', { nullable: true })
  intervention_group: boolean; // is member in control group?
  @Column('varchar', { length: 25, nullable: true })
  language?: Language;
  @Column('float')
  age: number;
  @Column('varchar', { length: 100, nullable: true })
  race?: Race;
  @Column('varchar', { length: 25, nullable: true })
  gender: Sex;
  @Column('varchar', { length: 100, nullable: true })
  street_address?: string;
  @Column('varchar', { length: 100, nullable: true })
  city?: string;
  @Column('varchar', { length: 25, nullable: true })
  state?: string;
  @Column('varchar', { length: 10, nullable: true })
  zip_code?: string;
  @Column('date', { nullable: true })
  admit_date: string;
  @Column('date', { nullable: true })
  discharge_date?: string;
  @Column('float', { nullable: true })
  los?: number;
  @Column('float', { nullable: true })
  days_since_discharge?: number;
  @Column('float', { nullable: true })
  active: boolean;
  @Column('float', { nullable: true })
  graduated: boolean;
  @Column('date', { nullable: true })
  graduation_date?: string;
  @Column('float', { nullable: true })
  first_activation_score?: number;
  @Column('float', { nullable: true })
  first_wellbeing_score: number;
  @Column('float', { nullable: true })
  last_activation_score?: number;
  @Column('float', { nullable: true })
  last_wellbeing_score?: number;
  @Column('varchar', { length: 100, nullable: true })
  fellow?: string;
  @Column('varchar', { length: 100, nullable: true })
  coach_name?: string;
  @Column('varchar', { length: 50, nullable: true })
  coach_id?: string;
  @Column('varchar', { length: 100, nullable: true })
  org_name: string;
  @Column('varchar', { length: 50, nullable: true })
  org_id: string;
  @Column('varchar', { length: 100, nullable: true })
  harmony_link?: string;
  @Column('float', { nullable: true })
  dc_summary_received: boolean;
  @Column('float', { nullable: true })
  dc_instructions_received: boolean;
  @Column('date', { nullable: true })
  dc_summary_load_date?: string; // Discharge Summary document load date (in S3)
  @Column('date', { nullable: true })
  dc_instructions_load_date?: string;
  @Column('blob', { nullable: true })
  general_notes?: string;
  @CreateDateColumn()
  load_datetime?: Date;
  @UpdateDateColumn()
  last_modified_datetime?: Date;
  @Column('varchar', { length: 50, nullable: true })
  marital_status?: MaritalStatus;
  @Column('float', { nullable: true })
  height?: number;
  @Column('float', { nullable: true })
  weight?: number;
  @Column('varchar', { length: 100, nullable: true })
  deceased_cause?: string;
  @Column('date', { nullable: true })
  deceased_date?: string;
  @Column('float', { nullable: true })
  deceased_days_from_dc?: number;
  @Column('float', { nullable: true })
  deceased_flag: boolean;
}

@Entity({ name: CoachTable })
export class CoachData {
  @PrimaryColumn('varchar', { length: 100 })
  user_id: string;
  @Column('datetime', { nullable: true })
  created: string;
  @Column('varchar', { length: 100 })
  first_name: string;
  @Column('varchar', { length: 100 })
  last_name: string;
  @Column('simple-array')
  roles: UserRole[];
  @Column('varchar', { length: 100, nullable: true })
  title?: string;
  @Column('varchar', { length: 15 })
  phone: string;
  @Column('varchar', { length: 100 })
  email: string;
  @Column('float')
  spanish: boolean;
  @Column('varchar', { length: 300, nullable: true })
  bio?: string;
  @Column('varchar', { length: 100 })
  avatar?: string;
  @Column('float', { nullable: true })
  max_members?: number;
  @Column('simple-array', { nullable: true })
  assigned_members?: string[];
  @CreateDateColumn()
  load_datetime?: Date;
  @UpdateDateColumn()
  last_modified_datetime?: Date;
}

@Entity({ name: QuestionnaireResponseTable })
export class QuestionnaireResponseData {
  @PrimaryGeneratedColumn()
  id: number;

  @PrimaryColumn('varchar', { length: 100 })
  member_id: string;

  @Column('varchar', { length: 50, name: 'qr_id' })
  qr_id: string;

  @Column('varchar', { length: 50, name: 'questionnaire_id' })
  questionnaire_id: string;

  @Column('varchar', { length: 50, name: 'questionnaire_type' })
  questionnaire_type: string;

  @Column('varchar', { length: 50, name: 'answer_name' })
  answer_code: string;

  @Column('varchar', { length: 50, name: 'answer_value' })
  answer_value: string;

  @Column('datetime', { nullable: true })
  created: string;
}

@Entity({ name: CaregiverTable })
export class CaregiverData {
  @PrimaryColumn('varchar', { length: 100 })
  id: string;

  @Column('varchar', { length: 50, name: 'member_id' })
  memberId: string;

  @Column('varchar', { length: 100, name: 'last_name' })
  lastName: string;

  @Column('varchar', { length: 100, name: 'first_name' })
  firstName: string;

  @Column('varchar', { length: 50 })
  phone: string;

  @Column('varchar', { length: 50, nullable: true })
  email?: string;

  @Column('varchar', { length: 50 })
  relationship: Relationship;

  @Column('float', { nullable: true })
  deleted: boolean;

  @Column('datetime', { nullable: true })
  created: string;
}

// AppointmentsMemberData represent the Analytics `appointments` expected spreadsheet columns list
@Entity({ name: AppointmentTable })
export class AppointmentsMemberData {
  @PrimaryGeneratedColumn()
  id: number;
  @Column('varchar', { length: 50, nullable: true })
  chat_id?: string;
  @Column('datetime', { nullable: true })
  created: string;
  @Column('datetime', { nullable: true })
  updated: string;
  @Column('longtext', { nullable: true })
  recap?: string;
  @Column('longtext', { nullable: true })
  strengths?: string;
  @Column('longtext', { nullable: true })
  member_plan?: string;
  @Column('longtext', { nullable: true })
  coach_plan?: string;
  @Column('float', { nullable: true })
  activation_score?: number;
  @Column('varchar', { length: 100, nullable: true })
  activation_reason?: string;
  @Column('float', { nullable: true })
  wellbeing_score?: number;
  @Column('varchar', { length: 100, nullable: true })
  wellbeing_reason?: string;
  @Column('float', { nullable: true })
  recorded_consent?: boolean;
  @Column('varchar', { length: 50 })
  customer_id: string;
  @Column('varchar', { length: 3 })
  mbr_initials: string;
  @Column('float', { nullable: true })
  appt_number?: number;
  @Column('date', { nullable: true })
  appt_date?: string;
  @Column('time', { nullable: true })
  appt_time_ct?: string;
  @Column('varchar', { length: 20, nullable: true })
  appt_status?: AppointmentAttendanceStatus;
  @Column('varchar', { length: 15, nullable: true })
  appt_day_of_week_name?: string;
  @Column('varchar', { length: 50, nullable: true })
  appt_hour?: number;
  @Column('varchar', { length: 20, nullable: true })
  status?: AppointmentStatus; // TODO: confirm with Alex that 'done' can replace 'closed' (consistency with our dto)
  @Column('float', { nullable: true })
  missed_appt?: boolean;
  @Column('varchar', { length: 200, nullable: true })
  no_show_reason?: string;
  @Column('float', { nullable: true })
  total_duration?: number;
  @Column('float', { nullable: true })
  total_outreach_attempts?: number;
  @Column('varchar', { length: 25, nullable: true })
  channel_primary?: RecordingType; // TODO: confirm with Alex that we can use the appointment method (not a 3'rd party vendor names - this coupling may not be healthy)
  @Column('varchar', { length: 50, nullable: true })
  event_type_primary?: AppointmentsEventType; // TODO: confirm with Alex how to determine primary event
  @Column('float', { nullable: true })
  is_video_call?: boolean;
  @Column('float', { nullable: true })
  is_phone_call?: boolean;
  @Column('date', { nullable: true })
  graduation_date?: string;
  @Column('float', { nullable: true })
  graduated?: boolean;
  @Column('float', { nullable: true })
  engaged?: boolean;
  @Column('varchar', { length: 100, nullable: true })
  coach_name?: string;
  @Column('varchar', { length: 50, nullable: true })
  coach_id?: string;
  @Column('varchar', { length: 100, nullable: true })
  harmony_link?: string;
  @CreateDateColumn()
  load_datetime?: Date;
  @UpdateDateColumn()
  last_modified_datetime?: Date;
}

export class BaseCareData {
  @PrimaryColumn('varchar', { length: 100 })
  id: string;
  @Column('varchar', { length: 50, name: 'member_id' })
  member_id: string;
  @Column('varchar', { length: 50 })
  type: string;
  @Column('datetime')
  created: string;
  @Column('datetime')
  updated: string;
  @Column('varchar', { length: 300, nullable: true })
  notes: string;
  @Column('datetime', { nullable: true })
  completed: string;
}

@Entity({ name: BarrierTypeTable })
export class BarrierTypeData {
  @PrimaryColumn('varchar', { length: 100 })
  id: string;
  @Column('varchar', { length: 200 })
  description: string;
  @Column('varchar', { length: 20 })
  domain: BarrierDomain;
  @Column('simple-array')
  carePlanTypes: string[];
}

@Entity({ name: BarrierTable })
export class BarrierData extends BaseCareData {
  @Column('varchar', { length: 50 })
  redFlagId: string;
  @Column('varchar', { length: 50 })
  status: BarrierStatus;
}

@Entity({ name: RedFlagTypeTable })
export class RedFlagTypeData {
  @PrimaryColumn('varchar', { length: 100 })
  id: string;
  @Column('varchar')
  description: string;
}

@Entity({ name: RedFlagTable })
export class RedFlagData {
  @PrimaryColumn('varchar', { length: 100 })
  id: string;
  @Column('varchar', { length: 100 })
  member_id: string;
  @Column('datetime')
  created: string;
  @Column('datetime')
  updated: string;
  @Column('varchar')
  type: string;
  @Column('varchar', { length: 300, nullable: true })
  notes?: string;
}

@Entity({ name: CarePlanTypeTable })
export class CarePlanTypeData {
  @PrimaryColumn('varchar', { length: 100 })
  id: string;
  @Column('varchar')
  description: string;
  @Column('float')
  isCustom: boolean;
}

@Entity({ name: CarePlanTable })
export class CarePlanData extends BaseCareData {
  @Column('varchar', { length: 50 })
  barrierId: string;
  @Column('datetime', { nullable: true })
  dueDate?: string;
  @Column('varchar', { length: 50 })
  status: CarePlanStatus;
}

export type AnalyticsData = CoachData | MemberData | AppointmentsMemberData;

export type PopulatedAppointment = Appointment & {
  _id: Types.ObjectId;
  notesData: Notes;
  recordings: Recording[];
};

export type PopulatedMember = Member & {
  primaryUser?: User;
};

export type MemberDataAggregate = BaseMember & {
  memberDetails: PopulatedMember;
  memberConfig?: MemberConfig;
  recentJourney?: Journey;
  appointments?: PopulatedAppointment[];
  primaryUser?: User;
  isControlMember?: boolean;
};
export type BaseMember = Member & {
  _id: Types.ObjectId;
};
export type CoachDataAggregate = {
  _id: Types.ObjectId;
  members: BaseMember[];
  user: User;
};

export type AnalyticsDataAggregate = CoachDataAggregate | MemberDataAggregate;

export type QuestionnaireResponseWithTimestamp = QuestionnaireResponseDocument & {
  createdAt: Date;
  updatedAt: Date;
};

export interface RecordingSummary {
  totalDuration: number;
  primaryChannel?: RecordingType;
}
