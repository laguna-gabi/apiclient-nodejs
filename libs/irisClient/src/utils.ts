import { ContentKey } from '.';

export const generateDispatchId = (contentKey: ContentKey, ...params: string[]) => {
  return params.length === 0 ? contentKey : `${contentKey}_${params.sort().join('_')}`;
};
