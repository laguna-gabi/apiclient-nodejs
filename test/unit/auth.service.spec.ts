import { RoleTypes, isAllowed } from '../../src/common';

describe('RBAC', () => {
  it.each([
    [
      'User is allowed if handler is annotated with Member role',
      RoleTypes.User,
      [RoleTypes.Member],
      true,
    ],
    [
      'User is allowed if handler is annotated with Member role',
      RoleTypes.Member,
      [RoleTypes.Member],
      true,
    ],
    [
      'Member is not allowed if handler is annotated with User role',
      RoleTypes.Member,
      [RoleTypes.User],
      false,
    ],
    [
      'User is allowed if handler is not annotated with Member role (default is User access)',
      RoleTypes.User,
      [],
      true,
    ],
    [
      'Member is not allowed if handler is not annotated with Member role (default is User access)',
      RoleTypes.Member,
      [],
      false,
    ],
    [
      'Member is allowed if handler is annotated with Member role and other roles',
      RoleTypes.Member,
      [RoleTypes.User, RoleTypes.Member],
      true,
    ],
    [
      'Member is allowed if handler is annotated with Member role and Anonymous roles',
      RoleTypes.Member,
      [RoleTypes.User, RoleTypes.Anonymous],
      true,
    ],
  ])('%p', async (message, role, annotatedRoles, expected) => {
    expect(isAllowed(role, annotatedRoles)).toBe(expected);
  });
});
