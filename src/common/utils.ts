import * as jwt from 'jsonwebtoken';

export const extractAuthorizationHeader = (context) => {
  const authorizationHeader = context.req?.headers?.authorization?.replace('Bearer ', '');
  return jwt.decode(authorizationHeader);
};

export const generateOrgNamePrefix = (orgName?: string): string => {
  return `${orgName ? ` [${orgName}] ` : ''}`;
};
