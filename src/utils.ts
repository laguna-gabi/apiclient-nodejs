import { ContentKey } from '.';

export const generateOrgNamePrefix = (orgName?: string): string => {
  return `${orgName ? ` [${orgName}] ` : ''}`;
};

export const generateDispatchId = (contentKey: ContentKey, memberId: string) => {
  return `${contentKey}_${memberId}`;
};
