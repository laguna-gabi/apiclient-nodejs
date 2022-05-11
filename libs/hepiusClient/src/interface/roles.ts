import { registerEnumType } from '@nestjs/graphql';

export enum MemberRole {
  member = 'member',
}
export enum UserRole {
  admin = 'admin',
  coach = 'coach',
  nurse = 'nurse',
}

export type RoleTypes = MemberRole | UserRole;

registerEnumType(UserRole, { name: 'UserRole' });
