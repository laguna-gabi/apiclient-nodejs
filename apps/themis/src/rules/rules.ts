import { EngineRule, Operator, TargetEntity } from './types';
import { DynamicFacts } from './facts';

export const engineRules: EngineRule[] = [
  {
    name: 'loneliness',
    active: true,
    conditions: {
      any: [
        {
          fact: 'member',
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
          fact: 'member',
          operator: Operator.equal,
          value: 0,
          path: '$.scheduledAppointments',
        },
        {
          fact: 'member',
          operator: Operator.equal,
          value: 0,
          path: '$.appointmentsToBeScheduled',
        },
        {
          fact: 'member',
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
  {
    name: 'test-real',
    active: true,
    conditions: {
      all: [
        {
          fact: DynamicFacts.barrierTypes,
          operator: Operator.contains,
          value: '628e1a509f92db6d2ba0bf86',
        },
      ],
    },
    event: {
      type: TargetEntity.carePlan,
      params: {
        type: '628e1a509f92db6d2ba0bf51',
        parentEntity: TargetEntity.barrier,
        parentEntityType: '628e1a509f92db6d2ba0bf86',
      },
    },
  },
];
