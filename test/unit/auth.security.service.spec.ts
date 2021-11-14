import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { Model } from 'mongoose';
import { UserSecurityService } from '../../src/auth';
import { Member } from '../../src/member';
import { User } from '../../src/user';
import { dbDisconnect } from '../index';

describe('UserSecurityService', () => {
  let service: UserSecurityService;
  let module: TestingModule;
  let memberModel: Model<Member>;
  let userModel: Model<User>;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      providers: [
        {
          provide: getModelToken(Member.name),
          useValue: Model,
        },
        {
          provide: getModelToken(User.name),
          useValue: Model,
        },
        UserSecurityService,
      ],
    }).compile();

    service = module.get<UserSecurityService>(UserSecurityService);

    memberModel = module.get<Model<Member>>(getModelToken(Member.name));
    userModel = module.get<Model<User>>(getModelToken(User.name));
  });

  afterAll(async () => {
    await module.close();
    await dbDisconnect();
  });

  describe('getUserByAuthId', () => {
    it('to be called with parameters', async () => {
      const spyOnUserModel = jest.spyOn(userModel, 'findOne').mockReturnValueOnce(null);
      await service.getUserByAuthId('auth-id');
      expect(spyOnUserModel).toBeCalledWith({ authId: 'auth-id' });
    });
  });

  describe('getMemberByAuthId', () => {
    it('to be called with parameters', async () => {
      const spyOnMemberModel = jest.spyOn(memberModel, 'findOne').mockReturnValueOnce(null);
      await service.getMemberByAuthId('auth-id');
      expect(spyOnMemberModel).toBeCalledWith({ authId: 'auth-id' });
    });
  });
});
