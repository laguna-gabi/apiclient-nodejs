import { DynamicFact } from './types';
import { Barrier, Caregiver } from '@argus/hepiusClient';

export enum DynamicFacts {
  caregiversCount = 'caregiversCount',
  barrierTypes = 'barrierTypes',
}

export const dynamicFacts: DynamicFact[] = [
  {
    id: DynamicFacts.caregiversCount,
    calculationMethod: async (params, almanac) => {
      const memberCaregivers: Caregiver[] = await almanac.factValue('caregivers');
      return memberCaregivers.length;
    },
  },
  {
    id: DynamicFacts.barrierTypes,
    calculationMethod: async (params, almanac) => {
      const barriers: Barrier[] = await almanac.factValue('barriers');
      return barriers.map((barrier) => barrier.type.id);
    },
  },
];
