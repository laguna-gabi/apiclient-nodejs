import { EngineRule, Operator, TargetEntity } from './types';
import { DynamicFacts } from './facts';

export enum BarrierType {
  behaviorLoneliness = '620e5dc8e2e136b29768387a',
}

export enum CarePlanType {
  extendCareCircle = '620cb5dbeba7107aef491064',
}

export const engineRules: EngineRule[] = [
  {
    name: 'extending-care-circle',
    active: true,
    conditions: {
      all: [
        {
          fact: DynamicFacts.barrierTypes,
          operator: Operator.contains,
          value: BarrierType.behaviorLoneliness,
        },
      ],
    },
    event: {
      type: TargetEntity.carePlan,
      params: {
        type: CarePlanType.extendCareCircle,
        parentEntity: TargetEntity.barrier,
        parentEntityType: BarrierType.behaviorLoneliness,
      },
    },
  },
];
