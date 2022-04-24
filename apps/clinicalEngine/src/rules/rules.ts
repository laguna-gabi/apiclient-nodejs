import { EngineRule, EventType, Operator } from './types';
import { DynamicFacts } from './facts';

interface ClinicalEngineRules {
  barriers: EngineRule[];
  carePlans: EngineRule[];
}

const barrierRules: EngineRule[] = [
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
      type: EventType.createBarrier,
      params: {
        type: 'appointment-follow-up-unclear',
      },
    },
  },
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
      type: EventType.createBarrier,
      params: {
        type: 'loneliness',
      },
    },
  },
];

const carePlanRules: EngineRule[] = [
  {
    name: 'content-about-combating-loneliness',
    active: true,
    conditions: {
      all: [
        {
          fact: DynamicFacts.newBarriers,
          operator: Operator.contains,
          value: 'loneliness',
        },
      ],
    },
    event: {
      type: EventType.createCarePlan,
      params: {
        type: 'content-about-combating-loneliness',
        barrierType: 'loneliness',
      },
    },
  },
];

export const engineRules: ClinicalEngineRules = {
  barriers: barrierRules,
  carePlans: carePlanRules,
};
