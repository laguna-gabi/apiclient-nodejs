import { DynamicFact } from './types';
import { DynamicFactCallback } from 'json-rules-engine';

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
  const newBarriers = await almanac.factValue(DynamicFacts.newBarriers);
  const updatedBarriers = newBarriers
    ? // todo: remove when defining types
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      newBarriers.push(event.params.type)
    : [event.params.type];
  almanac.addRuntimeFact(DynamicFacts.newBarriers, updatedBarriers);
};
