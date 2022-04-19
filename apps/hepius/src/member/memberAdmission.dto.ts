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
  externalScheduledAppointments = 'externalScheduledAppointments',
  externalToBeScheduledAppointments = 'externalToBeScheduledAppointments',
  activities = 'activities',
  woundCares = 'woundCares',
  dietary = 'dietary',
}
registerEnumType(AdmissionCategory, { name: 'AdmissionCategory' });

/**************************************************************************************************
 ************************************* Schemas for gql methods ************************************
 *************************************************************************************************/
export class BaseAdmission {
  @Field(() => String, { nullable: true })
  id?: string;
}

@ObjectType()
@Schema({ versionKey: false, timestamps: true })
export class Procedure extends BaseAdmission {
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
@Schema({ versionKey: false, timestamps: true })
export class Medication extends BaseAdmission {
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
@Schema({ versionKey: false, timestamps: true })
export class ExternalAppointment {
  @Prop({ isNan: true })
  @Field(() => String, { nullable: true })
  drName?: string;

  @Prop({ isNan: true })
  @Field(() => String, { nullable: true })
  instituteOrHospital?: string;

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
@Schema({ versionKey: false, timestamps: true })
export class Activity {
  @Prop({ isNan: true })
  @Field(() => String)
  text?: string;

  @Prop({ type: Boolean, isNan: true })
  @Field(() => Boolean)
  isTodo?: boolean;
}

@InputType()
export class WoundCare {
  @Field(() => String, { nullable: true })
  text?: string;
}

@InputType()
export class Dietary {
  @Field(() => String, { nullable: true })
  text?: string;

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

export class ChangeAdmissionDiagnosesParams extends ChangeAdmissionBaseParams {
  @Field(() => String)
  diagnoses: string;
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
export class ChangeAdmissionExternalAppointmentParams extends ChangeAdmissionBaseParams {
  @Field(() => ExternalAppointment)
  externalAppointment: ExternalAppointment;
}

@InputType()
export class ChangeAdmissionActivityParams extends ChangeAdmissionBaseParams {
  @Field(() => Activity)
  activity: Activity;
}

@InputType()
export class ChangeAdmissionWoundCareParams extends ChangeAdmissionBaseParams {
  @Field(() => WoundCare)
  woundCare: WoundCare;
}

@InputType()
export class ChangeAdmissionDietaryParams extends ChangeAdmissionBaseParams {
  @Field(() => Dietary)
  dietary: Dietary;
}

@InputType()
export class ChangeAdmissionParams {
  @Field(() => ChangeAdmissionDiagnosesParams, { nullable: true })
  diagnoses?: ChangeAdmissionDiagnosesParams;

  @Field(() => ChangeAdmissionProcedureParams, { nullable: true })
  procedure?: ChangeAdmissionProcedureParams;

  @Field(() => ChangeAdmissionMedicationParams, { nullable: true })
  medication?: ChangeAdmissionMedicationParams;

  @Field(() => ChangeAdmissionExternalAppointmentParams, { nullable: true })
  externalScheduledAppointment?: ChangeAdmissionExternalAppointmentParams;

  @Field(() => ChangeAdmissionExternalAppointmentParams, { nullable: true })
  externalToBeScheduledAppointment?: ChangeAdmissionExternalAppointmentParams;

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
  @Prop({ type: Types.ObjectId, unique: true, index: true })
  memberId: Types.ObjectId;

  @Prop({ isNaN: true })
  @Field(() => String, { nullable: true })
  diagnoses?: string;

  @Prop({ type: [{ type: Types.ObjectId, ref: Procedure.name }], isNaN: true })
  @Field(() => [Procedure], { nullable: true })
  procedures?: Procedure[];

  @Prop({ type: [{ type: Types.ObjectId, ref: Medication.name }], isNaN: true })
  @Field(() => [Medication], { nullable: true })
  medications?: Medication[];

  @Prop({ type: [{ type: Types.ObjectId, ref: ExternalAppointment.name }], isNaN: true })
  @Field(() => [ExternalAppointment], { nullable: true })
  externalScheduledAppointments?: ExternalAppointment[];

  @Prop({ type: [{ type: Types.ObjectId, ref: ExternalAppointment.name }], isNaN: true })
  @Field(() => [ExternalAppointment], { nullable: true })
  externalToBeScheduledAppointments?: ExternalAppointment[];

  @Prop({ type: [{ type: Types.ObjectId, ref: Activity.name }], isNaN: true })
  @Field(() => [Activity], { nullable: true })
  activities?: Activity[];

  @Prop({ type: [{ type: Types.ObjectId, ref: WoundCare.name }], isNaN: true })
  @Field(() => [WoundCare], { nullable: true })
  woundCares?: WoundCare[];

  @Prop({ type: Dietary, isNaN: true })
  @Field(() => Dietary, { nullable: true })
  dietary?: Dietary;
}

/**************************************************************************************************
 **************************************** Exported Schemas ****************************************
 *************************************************************************************************/
export type MemberAdmissionDocument = MemberAdmission & Document & ISoftDelete<MemberAdmission>;
export const MemberAdmissionDto = audit(
  SchemaFactory.createForClass(MemberAdmission).plugin(mongooseDelete, useFactoryOptions),
);

export type ProcedureDocument = Procedure & Document & ISoftDelete<Procedure>;
export const ProcedureDto = audit(
  SchemaFactory.createForClass(Procedure).plugin(mongooseDelete, useFactoryOptions),
);

export type MedicationDocument = Medication & Document & ISoftDelete<Medication>;
export const MedicationDto = audit(
  SchemaFactory.createForClass(Medication).plugin(mongooseDelete, useFactoryOptions),
);

export type ExternalScheduledAppointmentDocument = ExternalAppointment &
  Document &
  ISoftDelete<ExternalAppointment>;
export const ExternalScheduledAppointmentDto = audit(
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
