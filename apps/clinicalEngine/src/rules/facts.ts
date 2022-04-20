import { Fact } from 'json-rules-engine';

export const dynamicFacts: Partial<Fact>[] = [
  {
    id: 'caregiversCount',
    calculationMethod: async (params, almanac) => {
      const memberCaregivers = await almanac.factValue('caregivers');
      // todo: remove when defining types
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      return memberCaregivers.length;
    },
  },
  {
    id: 'barrierTypes',
    calculationMethod: async (params, almanac) => {
      const barriers = await almanac.factValue('barriers');
      // todo: remove when defining types
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      return barriers.map((barrier) => barrier.type);
    },
  },
];
