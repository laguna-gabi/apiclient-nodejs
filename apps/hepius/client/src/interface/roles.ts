import { registerEnumType } from '@nestjs/graphql';

export enum MemberRole {
  member = 'member',
}
export enum UserRole {
  lagunaAdmin = 'lagunaAdmin',
  lagunaCoach = 'lagunaCoach',
  lagunaNurse = 'lagunaNurse',
}

registerEnumType(UserRole, { name: 'UserRole' });

export type RoleTypes = MemberRole | UserRole;
