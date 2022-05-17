import { registerEnumType } from '@nestjs/graphql';

export enum MemberRole {
  member = 'member',
}
export enum UserRole {
  admin = 'admin',
  coach = 'coach',
  nurse = 'nurse',
}

registerEnumType(UserRole, { name: 'UserRole' });

export type RoleTypes = MemberRole | UserRole;
