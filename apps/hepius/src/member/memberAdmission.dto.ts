import { Field, InputType, ObjectType, registerEnumType } from '@nestjs/graphql';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { ChangeType, Identifier } from '../common';
import { ISoftDelete, audit, useFactoryOptions } from '../db';
import * as mongooseDelete from 'mongoose-delete';

/**************************************************************************************************
 ******************************* Enum registration for gql methods ********************************
 *************************************************************************************************/
export enum ProcedureType {
  treatment = 'treatment',
  diagnostic = 'diagnostic',
}
registerEnumType(ProcedureType, { name: 'ProcedureType' });

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
  icdCode?: string;

  @Prop({ isNan: true })
  @Field({ nullable: true })
  description?: string;
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
  diagnosis?: ChangeAdmissionDiagnosisParams;

  @Field(() => ChangeAdmissionProcedureParams, { nullable: true })
  procedure?: ChangeAdmissionProcedureParams;

  @Field(() => ChangeAdmissionMedicationParams, { nullable: true })
  medication?: ChangeAdmissionMedicationParams;

  @Field(() => ChangeAdmissionExternalAppointmentParams, { nullable: true })
  externalAppointment?: ChangeAdmissionExternalAppointmentParams;

  @Field(() => ChangeAdmissionActivityParams, { nullable: true })
  activity?: ChangeAdmissionActivityParams;

  @Field(() => ChangeAdmissionWoundCareParams, { nullable: true })
  woundCare?: ChangeAdmissionWoundCareParams;

  @Field(() => ChangeAdmissionDietaryParams, { nullable: true })
  dietary?: ChangeAdmissionDietaryParams;
}

/**************************************************************************************************
 ********************************* Return params for gql methods **********************************
 *************************************************************************************************/
@ObjectType()
@Schema({ versionKey: false, timestamps: true })
export class MemberAdmission extends Identifier {
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

  @Prop({ isNaN: true })
  @Field({ nullable: true })
  primaryCareProviderName?: string;

  @Prop({ isNaN: true })
  @Field({ nullable: true })
  medicalRecordNumber?: string;
}

/**************************************************************************************************
 **************************************** Exported Schemas ****************************************
 *************************************************************************************************/
export type MemberAdmissionDocument = MemberAdmission & Document & ISoftDelete<MemberAdmission>;
export const MemberAdmissionDto = audit(
  SchemaFactory.createForClass(MemberAdmission).plugin(mongooseDelete, useFactoryOptions),
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
