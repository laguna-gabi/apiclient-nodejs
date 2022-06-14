import { registerEnumType } from '@nestjs/graphql';
import { intersection } from 'lodash';

export enum MemberRole {
  member = 'member',
}
export enum UserRole {
  lagunaAdmin = 'lagunaAdmin',
  lagunaCoach = 'lagunaCoach',
  lagunaNurse = 'lagunaNurse',
  coach = 'coach',
}

registerEnumType(UserRole, { name: 'UserRole' });

export type RoleTypes = MemberRole | UserRole;

export const isLagunaUser = (roles?: UserRole[]): boolean => {
  return (
    intersection(roles, [UserRole.lagunaCoach, UserRole.lagunaAdmin, UserRole.lagunaNurse])
      ?.length > 0
  );
};
