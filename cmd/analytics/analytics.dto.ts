import { Types } from 'mongoose';
import { Appointment, AppointmentStatus, Notes } from '../../src/appointment';
import { User } from '../../src/user';
import { RecordingType } from '../../src/common';
import { Ethnicity, Member, MemberConfig, Race, Recording, Sex } from '../../src/member';
import { Language } from '@lagunahealth/pandora';
import * as config from 'config';

export const DateFormat = 'yyyy-MM-dd';
export const TimeFormat = 'HH:mm:ss';
export const DateTimeFormat = 'yyyy-MM-dd HH:mm';
export const DayOfWeekFormat = 'EEEE';
export const HourFormat = 'H';
export const DefaultOutputDir = './outputs';
export const HarmonyLink = config.get('hosts.harmony');
export const InstructionsFileSuffix = 'Instructions';
export const SummaryFileSuffix = 'Summary';
export const GraduationPeriod = 90;

export enum SheetOption {
  members = 'members',
  appointments = 'appointments',
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
export class MemberData {
  customer_id: string;
  mbr_initials: string;
  created: string;
  app_user: boolean; // is member using Laguna app?
  intervention_group: boolean; // is member in control group?
  language: Language;
  age: number;
  race: Race;
  ethnicity: Ethnicity;
  gender: Sex;
  street_address: string;
  city: string;
  state: string;
  zip_code: string;
  admit_date: string;
  discharge_date: string;
  los: number;
  days_since_discharge: number;
  active: boolean;
  graduated: boolean;
  graduation_date: string;
  first_activation_score: number;
  first_wellbeing_score: number;
  last_activation_score: number;
  last_wellbeing_score: number;
  fellow: string;
  coach_name: string;
  harmony_link: string;
  dc_summary_received: boolean;
  dc_instructions_received: boolean;
  dc_summary_load_date: string; // Discharge Summary document load date (in S3)
  dc_instructions_load_date: string;
}
// AppointmentsMemberData represent the Analytics `appointments` expected spreadsheet columns list
export class AppointmentsMemberData {
  created: string;
  customer_id: string;
  mbr_initials: string;
  appt_number: number;
  chat_id?: string;
  appt_date?: string;
  appt_time_ct?: string;
  appt_status?: AppointmentAttendanceStatus;
  appt_day_of_week_name?: string;
  appt_hour?: number;
  status?: AppointmentStatus; // TODO: confirm with Alex that 'done' can replace 'closed' (consistency with our dto)
  missed_appt?: string;
  total_duration?: number;
  total_outreach_attempts?: number;
  channel_primary?: RecordingType; // TODO: confirm with Alex that we can use the appointment method (not a 3'rd party vendor names - this coupling may not be healthy)
  event_type_primary?: AppointmentsEventType; // TODO: confirm with Alex how to determine primary event
  is_video_call?: boolean;
  is_phone_call?: boolean;
  graduation_date?: string;
  graduated?: boolean;
  engaged?: boolean;
  coach_name?: string;
  harmony_link?: string;
}

export type PopulatedAppointment = Appointment & {
  _id: Types.ObjectId;
  note: Notes;
  recordings: Recording[];
};

export type PopulatedMember = Member & {
  primaryUser: User;
};

export type MemberDataAggregate = Member & {
  _id: Types.ObjectId;
  memberDetails: PopulatedMember;
  memberConfig: MemberConfig;
  appointments: PopulatedAppointment[];
  primaryUser: User;
};

export interface RecordingSummary {
  totalDuration: number;
  primaryChannel?: RecordingType;
}
