import { EngineRule, Operator, TargetEntity } from './types';
import { DynamicFacts } from './facts';

export const engineRules: EngineRule[] = [
  {
    name: 'loneliness',
    active: true,
    conditions: {
      any: [
        {
          fact: 'memberInfo',
          operator: Operator.equal,
          value: true,
          path: '$.livesAlone',
        },
        {
          fact: DynamicFacts.caregiversCount,
          operator: Operator.lessThan,
          value: 2,
        },
      ],
    },
    event: {
      type: TargetEntity.barrier,
      params: {
        type: 'loneliness',
      },
    },
  },
  {
    name: 'appointment-follow-up-unclear',
    active: true,
    conditions: {
      all: [
        {
          fact: 'memberInfo',
          operator: Operator.equal,
          value: 0,
          path: '$.scheduledAppointments',
        },
        {
          fact: 'memberInfo',
          operator: Operator.equal,
          value: 0,
          path: '$.appointmentsToBeScheduled',
        },
        {
          fact: 'memberInfo',
          operator: Operator.equal,
          value: 1,
          path: '$.nested.example',
        },
      ],
    },
    event: {
      type: TargetEntity.barrier,
      params: {
        type: 'appointment-follow-up-unclear',
      },
    },
  },
  {
    name: 'content-about-combating-loneliness',
    active: true,
    conditions: {
      all: [
        {
          fact: DynamicFacts.barrierTypes,
          operator: Operator.contains,
          value: 'loneliness',
        },
      ],
    },
    event: {
      type: TargetEntity.carePlan,
      params: {
        type: 'content-about-combating-loneliness',
        parentEntity: TargetEntity.barrier,
        parentEntityType: 'loneliness',
      },
    },
  },
];
