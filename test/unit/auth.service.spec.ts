import { isAllowed, Roles } from '../../src/auth/roles';

describe('RBAC', () => {
  it.each([
    ['User is allowed if handler is annotated with Member role', Roles.User, [Roles.Member], true],
    [
      'User is allowed if handler is annotated with Member role',
      Roles.Member,
      [Roles.Member],
      true,
    ],
    [
      'Member is not allowed if handler is annotated with User role',
      Roles.Member,
      [Roles.User],
      false,
    ],
    [
      'User is allowed if handler is not annotated with Member role (default is User access)',
      Roles.User,
      [],
      true,
    ],
    [
      'Member is not allowed if handler is not annotated with Member role (default is User access)',
      Roles.Member,
      [],
      false,
    ],
    [
      'Member is allowed if handler is annotated with Member role and other roles',
      Roles.Member,
      [Roles.User, Roles.Member],
      true,
    ],
    [
      'Member is allowed if handler is annotated with Member role and Anonymous roles',
      Roles.Member,
      [Roles.User, Roles.Anonymous],
      true,
    ],
  ])('%p', async (message, role, annotatedRoles, expected) => {
    expect(isAllowed(role, annotatedRoles)).toBe(expected);
  });
});
