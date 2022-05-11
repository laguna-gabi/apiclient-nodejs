import { DynamicFact } from './types';

export enum DynamicFacts {
  caregiversCount = 'caregiversCount',
  barrierTypes = 'barrierTypes',
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
