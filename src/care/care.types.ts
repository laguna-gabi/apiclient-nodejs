import { registerEnumType } from '@nestjs/graphql';

export enum CareStatus {
  active = 'active',
  completed = 'completed',
}

registerEnumType(CareStatus, { name: 'CareStatus' });

export enum BarrierDomain {
  mobility = 'mobility',
  environment = 'environment',
  medical = 'medical',
  behavior = 'behavior',
  logistical = 'logistical',
  emotional = 'emotional',
}

registerEnumType(BarrierDomain, { name: 'BarrierCategory' });
