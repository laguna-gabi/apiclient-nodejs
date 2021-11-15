import { Test, TestingModule } from '@nestjs/testing';
import { Request } from 'express';
import * as jwt from 'jsonwebtoken';
import { AuthModule, AuthService, UserSecurityService } from '../../src/auth';
import { RoleTypes } from '../../src/common';
import { User } from '../../src/user';
import { dbDisconnect, defaultModules, mockGenerateMember, mockGenerateUser } from '../index';

describe('AuthService', () => {
  let service: AuthService;
  let module: TestingModule;
  let securityService: UserSecurityService;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: defaultModules().concat(AuthModule),
    }).compile();

    service = module.get<AuthService>(AuthService);
    securityService = module.get<UserSecurityService>(UserSecurityService);
  });

  afterAll(async () => {
    await module.close();
    await dbDisconnect();
  });

  describe('validateUser', () => {
    it('to return anonymous when authorization header is missing', async () => {
      expect(await service.validateUser({} as Request)).toEqual({ role: RoleTypes.Anonymous });
    });

    it('to return anonymous when authorization header is invalid', async () => {
      expect(
        await service.validateUser({ headers: { authorization: `Bearer invalid` } } as Request),
      ).toEqual({ role: RoleTypes.Anonymous });
    });

    it('to return anonymous when authorization header is missing sub', async () => {
      const token = jwt.sign({ email: 'john@doe.com' }, 'my-secret');

      expect(
        await service.validateUser({ headers: { authorization: `Bearer ${token}` } } as Request),
      ).toEqual({ role: RoleTypes.Anonymous });
    });

    // eslint-disable-next-line max-len
    it('to return a user when authorization header has a valid sub associated with a user', async () => {
      const token = jwt.sign({ email: 'john@doe.com', sub: 'my-sub' }, 'my-secret');

      const spyOnSecurityService = jest.spyOn(securityService, 'getUserByAuthId');

      const mockUser = mockGenerateUser();

      spyOnSecurityService.mockResolvedValueOnce(mockUser);

      const user = await service.validateUser({
        headers: { authorization: `Bearer ${token}` },
      } as Request);

      expect(spyOnSecurityService).toBeCalledWith('my-sub');

      expect(user).toEqual({ ...mockUser, role: RoleTypes.User });
      expect((user as User).id).toEqual(mockUser.id);
    });

    // eslint-disable-next-line max-len
    it('to return a member when authorization header has a valid sub associated with a member', async () => {
      const token = jwt.sign({ email: 'john@doe.com', sub: 'my-sub' }, 'my-secret');

      const spyOnSecurityServiceGetUser = jest.spyOn(securityService, 'getUserByAuthId');
      const spyOnSecurityServiceGetMember = jest.spyOn(securityService, 'getMemberByAuthId');

      const mockMember = mockGenerateMember();

      spyOnSecurityServiceGetUser.mockResolvedValueOnce(null);
      spyOnSecurityServiceGetMember.mockResolvedValueOnce(mockMember);

      const user = await service.validateUser({
        headers: { authorization: `Bearer ${token}` },
      } as Request);

      expect(spyOnSecurityServiceGetUser).toBeCalledWith('my-sub');
      expect(spyOnSecurityServiceGetMember).toBeCalledWith('my-sub');

      expect(user).toEqual({ ...mockMember, role: RoleTypes.Member });
      expect((user as User).id).toEqual(mockMember.id);
    });

    // eslint-disable-next-line max-len
    it('to return anonymous when authorization header has a sub which is NOT associated with either a member or a user', async () => {
      const token = jwt.sign({ email: 'john@doe.com', sub: 'my-sub' }, 'my-secret');

      const spyOnSecurityServiceGetUser = jest.spyOn(securityService, 'getUserByAuthId');
      const spyOnSecurityServiceGetMember = jest.spyOn(securityService, 'getMemberByAuthId');

      spyOnSecurityServiceGetUser.mockResolvedValueOnce(null);
      spyOnSecurityServiceGetMember.mockResolvedValueOnce(null);

      const user = await service.validateUser({
        headers: { authorization: `Bearer ${token}` },
      } as Request);

      expect(spyOnSecurityServiceGetUser).toBeCalledWith('my-sub');
      expect(spyOnSecurityServiceGetMember).toBeCalledWith('my-sub');

      expect(user).toEqual({ role: RoleTypes.Anonymous });
    });
  });

  describe('isAllowed', () => {
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
        // eslint-disable-next-line max-len
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
      expect(service.isAllowed(role, annotatedRoles)).toBe(expected);
    });
  });
});
