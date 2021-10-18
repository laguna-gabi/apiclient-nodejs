import * as jwt from 'jsonwebtoken';

export const extractHeader = (context) => {
  const authorizationHeader = context.req?.headers?.authorization?.replace('Bearer ', '');
  return jwt.decode(authorizationHeader);
};
