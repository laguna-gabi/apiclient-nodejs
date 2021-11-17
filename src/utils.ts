export const generateOrgNamePrefix = (orgName?: string): string => {
  return `${orgName ? ` [${orgName}] ` : ''}`;
};
