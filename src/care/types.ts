import { registerEnumType } from '@nestjs/graphql';

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
