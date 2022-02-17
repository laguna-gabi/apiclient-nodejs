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

export enum BarrierDomain {
  mobility = 'mobility',
  environment = 'environment',
  medical = 'medical',
  behavior = 'behavior',
  logistical = 'logistical',
  emotional = 'emotional',
}

registerEnumType(BarrierDomain, { name: 'BarrierCategory' });
