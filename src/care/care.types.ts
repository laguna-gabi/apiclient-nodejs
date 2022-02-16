import { registerEnumType } from '@nestjs/graphql';

export enum CareStatus {
  active = 'active',
  completed = 'completed',
}

registerEnumType(CareStatus, { name: 'CareStatus' });

export enum RedFlagType {
  chronicCondition = 'chronicCondition',
  appointment = 'appointment',
  resources = 'resources',
  medication = 'medication',
  planOfCare = 'planOfCare',
  weight = 'weight',
  health = 'health',
  medicalSupplies = 'medicalSupplies',
  other = 'other',
}

registerEnumType(RedFlagType, { name: 'RedFlagType' });

export enum BarrierType {
  fatigue = 'fatigue',
  Weakness = 'Weakness',
  Disability = 'Disability',
  homePreparation = 'homePreparation',
  assistance = 'assistance',
  medicalEquipment = 'medicalEquipment',
  nutrition = 'nutrition',
  monitoring = 'monitoring',
  homeSafety = 'homeSafety',
  generalEnvironment = 'generalEnvironment',
  medication = 'medication',
  appointment = 'appointment',
  providers = 'providers',
  understanding = 'understanding',
  literacy = 'literacy',
  woundCare = 'woundCare',
  painControl = 'painControl',
  homeProcedures = 'homeProcedures',
  parameters = 'parameters',
  readinessToChange = 'readinessToChange',
  motivation = 'motivation',
  preference = 'preference',
  financial = 'financial',
  familial = 'familial',
  competingResponsibilities = 'competingResponsibilities',
  transportation = 'transportation',
  language = 'language',
  grief = 'grief',
  mentalHealthIllness = 'mentalHealthIllness',
  loneliness = 'loneliness',
  healthCareWorry = 'healthCareWorry',
  recoveryWorry = 'recoveryWorry',
  denial = 'denial',
  locusOfControl = 'locusOfControl',
  caregiverConflicts = 'caregiverConflicts',
  emotionalSupport = 'emotionalSupport',
  trust = 'trust',
}

registerEnumType(BarrierType, { name: 'BarrierType' });
