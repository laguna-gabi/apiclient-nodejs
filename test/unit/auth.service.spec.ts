import { Test, TestingModule } from '@nestjs/testing';
import { Request } from 'express';
import * as jwt from 'jsonwebtoken';
import { AuthModule, AuthService, UserSecurityService } from '../../src/auth';
import { Logger } from '../../src/common';
import { User } from '../../src/user';
import {
  dbDisconnect,
  defaultModules,
  mockGenerateMember,
  mockGenerateUser,
  mockLogger,
} from '../index';

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
    mockLogger(module.get<Logger>(Logger));
  });

  afterAll(async () => {
    await module.close();
    await dbDisconnect();
  });

  describe('validateUser', () => {
    it('to return anonymous when authorization header is missing', async () => {
      expect(await service.validateUser({} as Request)).toEqual({});
    });

    it('to return anonymous when authorization header is invalid', async () => {
      expect(
        await service.validateUser({ headers: { authorization: `Bearer invalid` } } as Request),
      ).toBeUndefined();
    });

    it('to return anonymous when authorization header is missing sub', async () => {
      const token = jwt.sign({ email: 'john@doe.com' }, 'my-secret');

      expect(
        await service.validateUser({ headers: { authorization: `Bearer ${token}` } } as Request),
      ).toBeUndefined();
    });

    /* eslint-disable-next-line max-len */
    it('to return a user when authorization header has a valid sub associated with a user', async () => {
      const token = jwt.sign({ email: 'john@doe.com', sub: 'my-sub' }, 'my-secret');

      const spyOnSecurityService = jest.spyOn(securityService, 'getUserByAuthId');

      const mockUser = mockGenerateUser();

      spyOnSecurityService.mockResolvedValueOnce(mockUser);

      const user = await service.validateUser({
        headers: { authorization: `Bearer ${token}` },
      } as Request);

      expect(spyOnSecurityService).toBeCalledWith('my-sub');

      expect(user).toEqual(mockUser);
      expect((user as User).id).toEqual(mockUser.id);
    });

    /* eslint-disable-next-line max-len */
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

      expect(user).toEqual(mockMember);
      expect((user as User).id).toEqual(mockMember.id);
    });

    /* eslint-disable-next-line max-len */
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

      expect(user).toBeNull();
    });
  });
});
