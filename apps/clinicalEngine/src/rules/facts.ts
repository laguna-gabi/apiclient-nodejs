import { DynamicFact } from './types';
import { DynamicFactCallback } from 'json-rules-engine';
import { RulesService } from './rules.service';

export enum DynamicFacts {
  caregiversCount = 'caregiversCount',
  barrierTypes = 'barrierTypes',
  satisfiedBarriers = 'satisfiedBarriers',
}

export const dynamicFacts: DynamicFact[] = [
  {
    id: DynamicFacts.caregiversCount,
    calculationMethod: async (params, almanac) => {
      const memberCaregivers = await almanac.factValue('caregivers');
      // todo: remove when defining types
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      return memberCaregivers.length;
    },
  },
  {
    id: DynamicFacts.barrierTypes,
    calculationMethod: async (params, almanac) => {
      const barriers = await almanac.factValue('barriers');
      // todo: remove when defining types
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      return barriers.map((barrier) => barrier.type);
    },
  },
  {
    id: DynamicFacts.satisfiedBarriers,
  },
];

export const updateNewBarriersFact: DynamicFactCallback = async (event, almanac) => {
  // using lock in order to prevent concurrent changes to the satisfiedBarriers fact
  const lock = RulesService.lock;
  lock.use(async () => {
    const currentBarrierType = event.params.type;
    const barriersSatisfied = await almanac.factValue(DynamicFacts.satisfiedBarriers);
    const updatedBarriers = barriersSatisfied
      ? // todo: remove when defining types
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        newBarriers.push(currentBarrierType)
      : [currentBarrierType];
    await almanac.addRuntimeFact(DynamicFacts.satisfiedBarriers, updatedBarriers);
  });
};
