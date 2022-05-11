import { Field, InputType, ObjectType, registerEnumType } from '@nestjs/graphql';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import {
  ChangeType,
  ErrorType,
  Errors,
  IsIdAndChangeTypeAligned,
  IsOnlyDate,
  onlyDateRegex,
} from '../common';
import { ISoftDelete, audit, useFactoryOptions } from '../db';
import * as mongooseDelete from 'mongoose-delete';
import { Identifier } from '@argus/hepiusClient';
import { IsOptional, Matches, ValidateNested } from 'class-validator';

/**************************************************************************************************
 ******************************* Enum registration for gql methods ********************************
 *************************************************************************************************/
export enum ProcedureType {
  treatment = 'treatment',
  diagnostic = 'diagnostic',
  other = 'other',
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

export enum AdmitType {
  emergency = 'emergency',
  urgent = 'urgent',
  elective = 'elective',
  newborn = 'newborn',
  snf = 'snf',
  psych = 'psych',
  rehab = 'rehab',
}
registerEnumType(AdmitType, { name: 'AdmitType' });

export enum AdmitSource {
  physicianReferral = 'physician referral',
  clinicReferral = 'clinic referral',
  hmoReferral = 'hmo referral',
  transferFromHospital = 'transfer from a hospital',
  transferredFromSkilledNursing = 'transferred from skilled nursing',
  transferredFromAnotherFacility = 'transferred from another facility',
  emergencyRoom = 'emergency room',
  ecourtLowEnforcement = 'ecourt/law enforcement',
  infoNotAvailable = 'info not available',
}
registerEnumType(AdmitSource, { name: 'AdmitSource' });

export enum DischargeTo {
  home = 'home',
  hospital = 'hospital',
  snf = 'snf',
  icf = 'icf',
  anotherTypeOfInstitutionForInpatientCare = 'another type of institution for inpatient care',
  homeHealth = 'home health',
  leftAgainstMedicalAdviceOrDiscontinuedCare = 'left against medical advice or discontinued care',
  expired = 'expired',
  stillPatient = 'still patient',
  hospiceHome = 'hospice - home',
  hospiceMedicalFacility = 'hospice - medical facility',
}
registerEnumType(DischargeTo, { name: 'DischargeTo' });

export enum WarningSigns {
  confusion = 'confusion',
  difficultyBreathingOrShortnessOfBreath = 'difficulty breathing or shortness of breath',
  // eslint-disable-next-line max-len
  nauseaVomitingAndOrDiarrheaThatWillNotStop = 'nausea, vomiting and/or diarrhea that will not stop',
  passingOut = 'Passing out (Syncope)',
  severeDizziness = 'severe dizziness',
  significantIncreaseOrStartOfPain = 'significant increase or start of pain',
  tempOf101FOrHigher = 'temp of 101 F or higher',
  // eslint-disable-next-line max-len
  woundIncisionIsWorsening = 'wound/incision is worsening (increasing redness, swelling, tenderness, warmth, change in appearance, or increased drainage)',
}
registerEnumType(WarningSigns, { name: 'WarningSigns' });

export enum DietaryCategory {
  adverseReaction = 'adverse reaction diets',
  cultural = 'cultural diets',
  diabetic = 'diabetic diets',
  fiber = 'fiber diets',
  fluidRestrictions = 'fluid restrictions diets',
  fluid = 'fluid diets',
  heartHealthy = 'heart healthy diets',
  house = 'house diets',
  medication = 'medication diets',
  mineral = 'mineral diets',
  other = 'other',
  renal = 'renal diets',
  sodiumRestricted = 'sodium restricted diets',
  surgery = 'surgery',
  textureModified = 'texture modified diets',
  therapeutic = 'therapeutic diets',
  weightReduction = 'weight reduction diets',
}
registerEnumType(DietaryCategory, { name: 'DietaryCategory' });

export enum DietaryName {
  lowLactose = 'low lactose diet',
  glutenFree = 'gluten free diet',
  lactoseFree = 'lactose free diet',
  cantonese = 'cantonese diet',
  hindu = 'hindu diet',
  kosher = 'kosher diet',
  halalMeat = 'halal meat diet',
  diabetic = 'diabetic diet',
  maternalDiabetic = 'maternal diabetic diet',
  highFiber = 'high fiber diet',
  lowFiber = 'low fiber diet',
  fluidRestriction1500ml = '1500 ml fluid restriction diet',
  fluidRestriction = 'fluid restriction diet',
  fluidIncreased = 'fluid increased diet',
  clearFluids = 'clear fluids diet',
  fullFluids = 'full fluids diet',
  cardiac = 'cardiac diet',
  lowCholesterol = 'low cholesterol diet',
  dietaryApproachesToStopHypertension = 'dietary approaches to stop hypertension (DASH) diet',
  lowFat = 'low fat diet',
  regularMaternal = 'regular maternal diet',
  vegetarian = 'vegetarian diet',
  vegan = 'vegan',
  decreasedTyramine = 'decreased tyramine diet',
  VitaminKRestriction = 'vitamin k restriction diet',
  increasedIron = 'increased iron diet',
  decreasedCalcium = 'decreased calcium diet',
  increasedCalcium = 'increased calcium diet',
  decreasedIron = 'decreased iron diet',
  lowCarbohydrate = 'low carbohydrate diet',
  lowProtein = 'low protein diet',
  fasting = 'fasting',
  lowPotassium = 'low potassium diet',
  chronicKidneyDiseaseHemodialysis = 'chronic kidney disease hemodialysis',
  // eslint-disable-next-line max-len
  acuteRenalFailurePeritonealDialysisRenalTransplant = 'acute renal failure peritoneal dialysis renal transplant',
  lowSodium = 'low sodium diet',
  bariatricSurgery = 'bariatric surgery diet',
  easyToChew = 'easy to chew diet',
  mechanicallyAltered = 'mechanically altered diet',
  pureed = 'pureed diet',
  antiReflux = 'anti-reflux diet',
  lowCalorie = 'low calorie diet',
  dietaryTreatmentForDisorder = 'dietary treatment for disorder',
  highCalorieAndHighProtein = 'high calorie and high protein',
  atkins = 'atkins diet',
  keto = 'keto diet',
  paleo = 'paleo diet',
}
registerEnumType(DietaryName, { name: 'DietaryName' });

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
  @IsOnlyDate({ message: Errors.get(ErrorType.admissionDiagnosisOnsetStart) })
  onsetStart?: string;

  @Prop({ isNan: true })
  @Field({ nullable: true })
  @IsOnlyDate({ message: Errors.get(ErrorType.admissionDiagnosisOnsetEnd) })
  onsetEnd?: string;
}

@ObjectType()
@InputType('ProcedureInput')
@Schema({ versionKey: false, timestamps: true })
export class Procedure extends BaseCategory {
  @Prop({ isNan: true })
  @Field({ nullable: true })
  @IsOnlyDate({ message: Errors.get(ErrorType.admissionProcedureDate) })
  date?: string;

  @Prop({ type: String, enum: ProcedureType, isNan: true })
  @Field(() => ProcedureType, { nullable: true })
  procedureType?: ProcedureType;

  @Prop({ isNan: true })
  @Field(() => String, { nullable: true })
  description?: string;
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
  clinic?: string;

  @Prop({ type: Date, isNan: true })
  @Field(() => Date, { nullable: true })
  date?: Date;

  @Prop({ isNan: true })
  @Field(() => String, { nullable: true })
  type?: string;

  @Prop({ isNan: true })
  @Field(() => String, { nullable: true })
  specialInstructions?: string;

  @Prop({ isNan: true })
  @Field(() => String, { nullable: true })
  fullAddress?: string;

  @Prop({ isNan: true })
  @Field(() => String, { nullable: true })
  phone?: string;

  @Prop({ isNan: true })
  @Field(() => String, { nullable: true })
  fax?: string;
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

  /**
   * Single fields on change admission
   */
  @Field(() => String, { nullable: true })
  @Matches(onlyDateRegex, { message: Errors.get(ErrorType.memberAdmitDate) })
  @IsOptional()
  admitDate?: string;

  @Field(() => AdmitType, { nullable: true })
  admitType?: AdmitType;

  @Field(() => AdmitSource, { nullable: true })
  admitSource?: AdmitSource;

  @Field(() => String, { nullable: true })
  @Matches(onlyDateRegex, { message: Errors.get(ErrorType.memberDischargeDate) })
  @IsOptional()
  dischargeDate?: string;

  @Field(() => DischargeTo, { nullable: true })
  dischargeTo?: DischargeTo;

  @Field(() => String, { nullable: true })
  facility?: string;

  @Field(() => String, { nullable: true })
  specialInstructions?: string;

  @Field(() => String, { nullable: true })
  reasonForAdmission?: string;

  @Field(() => String, { nullable: true })
  hospitalCourse?: string;

  @Field(() => WarningSigns, { nullable: true })
  warningSigns?: WarningSigns;

  /**
   * Lists on change admission
   */
  @Field(() => ChangeAdmissionDiagnosisParams, { nullable: true })
  @IsIdAndChangeTypeAligned({ message: Errors.get(ErrorType.admissionIdAndChangeTypeAligned) })
  diagnosis?: ChangeAdmissionDiagnosisParams;

  @Field(() => ChangeAdmissionProcedureParams, { nullable: true })
  @IsIdAndChangeTypeAligned({ message: Errors.get(ErrorType.admissionIdAndChangeTypeAligned) })
  @ValidateNested()
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
}

/**************************************************************************************************
 ********************************* Return params for gql methods **********************************
 *************************************************************************************************/
export const singleAdmissionItems = [
  'admitDate',
  'admitType',
  'admitSource',
  'dischargeDate',
  'dischargeTo',
  'facility',
  'specialInstructions',
  'reasonForAdmission',
  'hospitalCourse',
  'warningSigns',
];

@ObjectType()
@Schema({ versionKey: false, timestamps: true })
export class Admission extends Identifier {
  @Prop({ type: Types.ObjectId, index: true })
  memberId: Types.ObjectId;

  /**
   * Single fields on admission
   */
  @Prop({ isNaN: true })
  @Field(() => String, { nullable: true })
  admitDate?: string;

  @Prop({ type: String, enum: AdmitType, isNan: true })
  @Field(() => AdmitType, { nullable: true })
  admitType?: AdmitType;

  @Prop({ type: String, enum: AdmitSource, isNan: true })
  @Field(() => AdmitSource, { nullable: true })
  admitSource?: AdmitSource;

  @Prop({ isNaN: true })
  @Field(() => String, { nullable: true })
  dischargeDate?: string;

  @Prop({ type: String, enum: DischargeTo, isNan: true })
  @Field(() => DischargeTo, { nullable: true })
  dischargeTo?: DischargeTo;

  @Prop({ isNaN: true })
  @Field(() => String, { nullable: true })
  facility?: string;

  @Prop({ isNaN: true })
  @Field(() => String, { nullable: true })
  specialInstructions?: string;

  @Prop({ isNaN: true })
  @Field(() => String, { nullable: true })
  reasonForAdmission?: string;

  @Prop({ isNaN: true })
  @Field(() => String, { nullable: true })
  hospitalCourse?: string;

  @Prop({ type: String, enum: WarningSigns, isNan: true })
  @Field(() => WarningSigns, { nullable: true })
  warningSigns?: WarningSigns;

  /**
   * Lists on admission
   */
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
}

@ObjectType()
export class DietaryMapTuple {
  @Field(() => DietaryCategory)
  key: DietaryCategory;

  @Field(() => [DietaryName])
  values: DietaryName[];
}

@ObjectType()
export class DietaryMatcher {
  @Field(() => [DietaryMapTuple])
  map: DietaryMapTuple[];
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
