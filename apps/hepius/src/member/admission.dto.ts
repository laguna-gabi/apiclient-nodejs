import { Field, InputType, ObjectType, registerEnumType } from '@nestjs/graphql';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import {
  ChangeType,
  ErrorType,
  Errors,
  IsIdAndChangeTypeAligned,
  IsOnlyDateInSub,
  onlyDateRegex,
} from '../common';
import { ISoftDelete, audit, useFactoryOptions } from '../db';
import * as mongooseDelete from 'mongoose-delete';
import { Identifier } from '@argus/hepiusClient';
import { IsOptional, Matches } from 'class-validator';

/**************************************************************************************************
 ******************************* Enum registration for gql methods ********************************
 *************************************************************************************************/
export enum ProcedureType {
  treatment = 'treatment',
  diagnostic = 'diagnostic',
}
registerEnumType(ProcedureType, { name: 'ProcedureType' });

export enum PrimaryDiagnosisType {
  principal = 'principal',
  admitting = 'admitting',
  clinical = 'clinical',
  discharge = 'discharge',
  retrospective = 'retrospective',
  self = 'self',
  differential = 'differential',
}
registerEnumType(PrimaryDiagnosisType, { name: 'PrimaryDiagnosisType' });

export enum SecondaryDiagnosisType {
  laboratory = 'laboratory',
  nursing = 'nursing',
  prenatal = 'prenatal',
  radiology = 'radiology',
  remote = 'remote',
}
registerEnumType(SecondaryDiagnosisType, { name: 'SecondaryDiagnosisType' });

export enum ClinicalStatus {
  active = 'active',
  recurrence = 'recurrence',
  relapse = 'relapse',
  inactive = 'inactive',
  remission = 'remission',
  resolved = 'resolved',
}
registerEnumType(ClinicalStatus, { name: 'ClinicalStatus' });

export enum DiagnosisSeverity {
  severe = 'severe',
  moderate = 'moderate',
  mild = 'mild',
}
registerEnumType(DiagnosisSeverity, { name: 'DiagnosisSeverity' });

export enum AdmissionCategory {
  diagnoses = 'diagnoses',
  procedures = 'procedures',
  medications = 'medications',
  externalAppointments = 'externalAppointments',
  activities = 'activities',
  woundCares = 'woundCares',
  dietaries = 'dietaries',
}
registerEnumType(AdmissionCategory, { name: 'AdmissionCategory' });

/**************************************************************************************************
 ************************************* Schemas for gql methods ************************************
 *************************************************************************************************/
@ObjectType()
@InputType('BaseCategoryInput')
export class BaseCategory {
  @Field(() => String, { nullable: true })
  id?: string;
}

@ObjectType()
@InputType('DiagnosisInput')
@Schema({ versionKey: false, timestamps: true })
export class Diagnosis extends BaseCategory {
  @Prop({ isNan: true })
  @Field({ nullable: true })
  code?: string;

  @Prop({ isNan: true })
  @Field({ nullable: true })
  description?: string;

  @Prop({ type: String, enum: PrimaryDiagnosisType, default: PrimaryDiagnosisType.clinical })
  @Field(() => PrimaryDiagnosisType, { nullable: true })
  primaryType?: PrimaryDiagnosisType;

  @Prop({ type: String, enum: SecondaryDiagnosisType, isNan: true })
  @Field(() => SecondaryDiagnosisType, { nullable: true })
  secondaryType?: SecondaryDiagnosisType;

  @Prop({ type: String, enum: ClinicalStatus, isNan: true })
  @Field(() => ClinicalStatus, { nullable: true })
  clinicalStatus?: ClinicalStatus;

  @Prop({ type: String, enum: DiagnosisSeverity, isNan: true })
  @Field(() => DiagnosisSeverity, { nullable: true })
  severity?: DiagnosisSeverity;

  @Prop({ isNan: true })
  @Field({ nullable: true })
  onsetStart?: string;

  @Prop({ isNan: true })
  @Field({ nullable: true })
  onsetEnd?: string;
}

@ObjectType()
@InputType('ProcedureInput')
@Schema({ versionKey: false, timestamps: true })
export class Procedure extends BaseCategory {
  @Prop({ type: Date, isNan: true })
  @Field(() => Date, { nullable: true })
  date?: Date;

  @Prop({ type: String, enum: ProcedureType, isNan: true })
  @Field(() => ProcedureType, { nullable: true })
  procedureType?: ProcedureType;

  @Prop({ isNan: true })
  @Field(() => String, { nullable: true })
  text?: string;
}

@ObjectType()
@InputType('AmountInput')
@Schema({ versionKey: false, timestamps: true })
export class Amount {
  @Prop({ type: Number, isNan: true })
  @Field(() => Number, { nullable: true })
  amount?: number;

  @Prop({ isNan: true })
  @Field(() => String, { nullable: true })
  unitType?: string;
}

@ObjectType()
@InputType('MedicationInput')
@Schema({ versionKey: false, timestamps: true })
export class Medication extends BaseCategory {
  @Prop({ isNan: true })
  @Field(() => String, { nullable: true })
  name?: string;

  @Prop({ isNan: true })
  @Field(() => String, { nullable: true })
  frequency?: string;

  @Prop({ isNan: true })
  @Field(() => String, { nullable: true })
  type?: string;

  @Prop({ type: Amount, isNan: true })
  @Field(() => Amount, { nullable: true })
  amount?: Amount;

  @Prop({ type: Date, isNan: true })
  @Field(() => Date, { nullable: true })
  startDate?: Date;

  @Prop({ type: Date, isNan: true })
  @Field(() => Date, { nullable: true })
  endDate?: Date;

  @Prop({ isNan: true })
  @Field(() => String, { nullable: true })
  memberNote?: string;

  @Prop({ isNan: true })
  @Field(() => String, { nullable: true })
  coachNote?: string;
}

@ObjectType()
@InputType('ExternalAppointmentInput')
@Schema({ versionKey: false, timestamps: true })
export class ExternalAppointment extends BaseCategory {
  @Prop({ default: true })
  @Field(() => Boolean, { nullable: true })
  isScheduled?: boolean;

  @Prop({ isNan: true })
  @Field(() => String, { nullable: true })
  drName?: string;

  @Prop({ isNan: true })
  @Field(() => String, { nullable: true })
  instituteOrHospitalName?: string;

  @Prop({ type: Date, isNan: true })
  @Field(() => Date, { nullable: true })
  date?: Date;

  @Prop({ isNan: true })
  @Field(() => String, { nullable: true })
  phone?: string;

  @Prop({ isNan: true })
  @Field(() => String, { nullable: true })
  description?: string;

  @Prop({ isNan: true })
  @Field(() => String, { nullable: true })
  address?: string;
}

@ObjectType()
@InputType('ActivityInput')
@Schema({ versionKey: false, timestamps: true })
export class Activity extends BaseCategory {
  @Prop({ isNan: true })
  @Field(() => String, { nullable: true })
  text?: string;

  @Prop({ default: true })
  @Field(() => Boolean, { nullable: true })
  isTodo?: boolean;
}

@ObjectType()
@InputType('WoundCareInput')
@Schema({ versionKey: false, timestamps: true })
export class WoundCare extends BaseCategory {
  @Prop({ isNan: true })
  @Field(() => String, { nullable: true })
  text?: string;
}

@ObjectType()
@InputType('DietaryInput')
@Schema({ versionKey: false, timestamps: true })
export class Dietary extends BaseCategory {
  @Prop({ isNan: true })
  @Field(() => String, { nullable: true })
  text?: string;

  @Prop({ isNan: true })
  @Field(() => String, { nullable: true })
  bmi?: string;
}

/**************************************************************************************************
 ********************************** Input params for gql methods **********************************
 *************************************************************************************************/
@InputType()
export class ChangeAdmissionBaseParams {
  @Field(() => ChangeType)
  changeType: ChangeType;
}

@InputType()
export class ChangeAdmissionDiagnosisParams extends Diagnosis {
  @Field(() => ChangeType)
  changeType: ChangeType;
}

@InputType()
export class ChangeAdmissionProcedureParams extends Procedure {
  @Field(() => ChangeType)
  changeType: ChangeType;
}

@InputType()
export class ChangeAdmissionMedicationParams extends Medication {
  @Field(() => ChangeType)
  changeType: ChangeType;
}

@InputType()
export class ChangeAdmissionExternalAppointmentParams extends ExternalAppointment {
  @Field(() => ChangeType)
  changeType: ChangeType;
}

@InputType()
export class ChangeAdmissionActivityParams extends Activity {
  @Field(() => ChangeType)
  changeType: ChangeType;
}

@InputType()
export class ChangeAdmissionWoundCareParams extends WoundCare {
  @Field(() => ChangeType)
  changeType: ChangeType;
}

@InputType()
export class ChangeAdmissionDietaryParams extends Dietary {
  @Field(() => ChangeType)
  changeType: ChangeType;
}

@InputType()
export class ChangeMemberDnaParams {
  @Field()
  memberId: string;

  /**
   * if id is provided, we're changing an existing admission entity.
   * if id is NOT provided, we're creating a new admission entity.
   */
  @Field({ nullable: true })
  id?: string;

  @Field(() => ChangeAdmissionDiagnosisParams, { nullable: true })
  @IsIdAndChangeTypeAligned({ message: Errors.get(ErrorType.admissionIdAndChangeTypeAligned) })
  @IsOnlyDateInSub('onsetStart', { message: Errors.get(ErrorType.admissionDiagnosisOnsetStart) })
  @IsOnlyDateInSub('onsetEnd', { message: Errors.get(ErrorType.admissionDiagnosisOnsetEnd) })
  diagnosis?: ChangeAdmissionDiagnosisParams;

  @Field(() => ChangeAdmissionProcedureParams, { nullable: true })
  @IsIdAndChangeTypeAligned({ message: Errors.get(ErrorType.admissionIdAndChangeTypeAligned) })
  procedure?: ChangeAdmissionProcedureParams;

  @Field(() => ChangeAdmissionMedicationParams, { nullable: true })
  @IsIdAndChangeTypeAligned({ message: Errors.get(ErrorType.admissionIdAndChangeTypeAligned) })
  medication?: ChangeAdmissionMedicationParams;

  @Field(() => ChangeAdmissionExternalAppointmentParams, { nullable: true })
  @IsIdAndChangeTypeAligned({ message: Errors.get(ErrorType.admissionIdAndChangeTypeAligned) })
  externalAppointment?: ChangeAdmissionExternalAppointmentParams;

  @Field(() => ChangeAdmissionActivityParams, { nullable: true })
  @IsIdAndChangeTypeAligned({ message: Errors.get(ErrorType.admissionIdAndChangeTypeAligned) })
  activity?: ChangeAdmissionActivityParams;

  @Field(() => ChangeAdmissionWoundCareParams, { nullable: true })
  @IsIdAndChangeTypeAligned({ message: Errors.get(ErrorType.admissionIdAndChangeTypeAligned) })
  woundCare?: ChangeAdmissionWoundCareParams;

  @Field(() => ChangeAdmissionDietaryParams, { nullable: true })
  @IsIdAndChangeTypeAligned({ message: Errors.get(ErrorType.admissionIdAndChangeTypeAligned) })
  dietary?: ChangeAdmissionDietaryParams;

  /**
   * Single fields on change admission
   */
  @Field(() => String, { nullable: true })
  @Matches(onlyDateRegex, { message: Errors.get(ErrorType.memberAdmitDate) })
  @IsOptional()
  admitDate?: string;

  @Field(() => String, { nullable: true })
  @Matches(onlyDateRegex, { message: Errors.get(ErrorType.memberDischargeDate) })
  @IsOptional()
  dischargeDate?: string;
}

/**************************************************************************************************
 ********************************* Return params for gql methods **********************************
 *************************************************************************************************/
@ObjectType()
@Schema({ versionKey: false, timestamps: true })
export class Admission extends Identifier {
  @Prop({ type: Types.ObjectId, index: true })
  memberId: Types.ObjectId;

  @Prop({ type: [{ type: Types.ObjectId, ref: Diagnosis.name }], isNaN: true })
  @Field(() => [Diagnosis], { nullable: true })
  diagnoses?: Diagnosis[];

  @Prop({ type: [{ type: Types.ObjectId, ref: Procedure.name }], isNaN: true })
  @Field(() => [Procedure], { nullable: true })
  procedures?: Procedure[];

  @Prop({ type: [{ type: Types.ObjectId, ref: Medication.name }], isNaN: true })
  @Field(() => [Medication], { nullable: true })
  medications?: Medication[];

  @Prop({ type: [{ type: Types.ObjectId, ref: ExternalAppointment.name }], isNaN: true })
  @Field(() => [ExternalAppointment], { nullable: true })
  externalAppointments?: ExternalAppointment[];

  @Prop({ type: [{ type: Types.ObjectId, ref: Activity.name }], isNaN: true })
  @Field(() => [Activity], { nullable: true })
  activities?: Activity[];

  @Prop({ type: [{ type: Types.ObjectId, ref: WoundCare.name }], isNaN: true })
  @Field(() => [WoundCare], { nullable: true })
  woundCares?: WoundCare[];

  @Prop({ type: [{ type: Types.ObjectId, ref: Dietary.name }], isNaN: true })
  @Field(() => [Dietary], { nullable: true })
  dietaries?: Dietary[];

  /**
   * Single fields on admission
   */
  @Prop({ isNaN: true })
  @Field(() => String, { nullable: true })
  admitDate?: string;

  @Prop({ isNaN: true })
  @Field(() => String, { nullable: true })
  dischargeDate?: string;
}

/**************************************************************************************************
 **************************************** Exported Schemas ****************************************
 *************************************************************************************************/
export type AdmissionDocument = Admission & Document & ISoftDelete<Admission>;
export const AdmissionDto = audit(
  SchemaFactory.createForClass(Admission).plugin(mongooseDelete, useFactoryOptions),
);

export type DiagnosisDocument = Diagnosis & Document & ISoftDelete<Diagnosis>;
export const DiagnosisDto = audit(
  SchemaFactory.createForClass(Diagnosis).plugin(mongooseDelete, useFactoryOptions),
);

export type ProcedureDocument = Procedure & Document & ISoftDelete<Procedure>;
export const ProcedureDto = audit(
  SchemaFactory.createForClass(Procedure).plugin(mongooseDelete, useFactoryOptions),
);

export type MedicationDocument = Medication & Document & ISoftDelete<Medication>;
export const MedicationDto = audit(
  SchemaFactory.createForClass(Medication).plugin(mongooseDelete, useFactoryOptions),
);

export type ExternalAppointmentDocument = ExternalAppointment &
  Document &
  ISoftDelete<ExternalAppointment>;
export const ExternalAppointmentDto = audit(
  SchemaFactory.createForClass(ExternalAppointment).plugin(mongooseDelete, useFactoryOptions),
);

export type ActivityDocument = Activity & Document & ISoftDelete<Activity>;
export const ActivityDto = audit(
  SchemaFactory.createForClass(Activity).plugin(mongooseDelete, useFactoryOptions),
);

export type WoundCareDocument = WoundCare & Document & ISoftDelete<WoundCare>;
export const WoundCareDto = audit(
  SchemaFactory.createForClass(WoundCare).plugin(mongooseDelete, useFactoryOptions),
);

export type DietaryDocument = Dietary & Document & ISoftDelete<Dietary>;
export const DietaryDto = audit(
  SchemaFactory.createForClass(Dietary).plugin(mongooseDelete, useFactoryOptions),
);
