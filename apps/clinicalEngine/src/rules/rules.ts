import { EngineRule, EventType, Operator, RuleType } from './types';
import { DynamicFacts } from './facts';
import { DynamicFactCallback } from 'json-rules-engine';
import { RulesService } from './rules.service';

export const Priorities = new Map<RuleType, number>([
  [RuleType.barrier, 10],
  [RuleType.carePlan, 1],
]);

export const Callbacks = new Map<RuleType, DynamicFactCallback>([
  [
    RuleType.barrier,
    async (event, almanac) => {
      // using lock in order to prevent concurrent changes to the satisfiedBarriers fact
      const lock = RulesService.lock;
      lock.use(async () => {
        const currentBarrierType = event.params.type;
        const satisfiedBarriers = await almanac.factValue(DynamicFacts.satisfiedBarriers);
        // todo: remove when defining types
        // eslint-disable-next-line
        // @ts-ignore
        satisfiedBarriers.push(currentBarrierType);

        await almanac.addRuntimeFact(DynamicFacts.satisfiedBarriers, satisfiedBarriers);
      });
    },
  ],
]);

export const engineRules: EngineRule[] = [
  {
    name: 'loneliness',
    type: RuleType.barrier,
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
  {
    name: 'appointment-follow-up-unclear',
    type: RuleType.barrier,
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
    name: 'loneliness2',
    type: RuleType.barrier,
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
        type: 'loneliness2',
      },
    },
  },
  {
    name: 'content-about-combating-loneliness',
    type: RuleType.carePlan,
    active: true,
    conditions: {
      all: [
        {
          fact: DynamicFacts.satisfiedBarriers,
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
