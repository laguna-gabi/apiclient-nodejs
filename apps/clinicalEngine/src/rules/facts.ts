import { DynamicFact, EventType } from './types';
import { DynamicFactCallback } from 'json-rules-engine';
import { generateFactName } from './utils';

export enum DynamicFacts {
  caregiversCount = 'caregiversCount',
  barrierTypes = 'barrierTypes',
  newBarriers = 'newBarriers',
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
];

export const updateNewBarriersFact: DynamicFactCallback = async (event, almanac) => {
  const factId = generateFactName(EventType.createBarrier, event.params.type, true);
  await almanac.addRuntimeFact(factId, true);
};
