import { Test, TestingModule } from '@nestjs/testing';
import {
  dbDisconnect,
  generateGetCommunicationParams,
  generateId,
  mockGenerateMember,
  mockGenerateUser,
} from '../index';
import { DbModule } from '../../src/db/db.module';
import { EventEmitterModule } from '@nestjs/event-emitter';
import {
  CommunicationModule,
  CommunicationResolver,
  CommunicationService,
} from '../../src/communication';
import * as config from 'config';
import * as faker from 'faker';
import { v4 } from 'uuid';

describe('CommunicationResolver', () => {
  let module: TestingModule;
  let resolver: CommunicationResolver;
  let service: CommunicationService;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [DbModule, CommunicationModule, EventEmitterModule.forRoot()],
    }).compile();

    resolver = module.get<CommunicationResolver>(CommunicationResolver);
    service = module.get<CommunicationService>(CommunicationService);
  });

  afterAll(async () => {
    await module.close();
    await dbDisconnect();
  });

  describe('handleNewUser', () => {
    let spyOnServiceCreateUser;
    beforeEach(() => {
      spyOnServiceCreateUser = jest.spyOn(service, 'createUser');
    });

    afterEach(() => {
      spyOnServiceCreateUser.mockReset();
    });

    it('should successfully handle a new user', async () => {
      spyOnServiceCreateUser.mockImplementationOnce(() => undefined);

      const user = mockGenerateUser();
      await resolver.handleNewUser({ user });
      expect(spyOnServiceCreateUser).toBeCalledWith(user);
    });
  });

  describe('handleNewMember', () => {
    let spyOnServiceCreateMember;
    let spyOnServiceConnectMemberToUser;
    beforeEach(() => {
      spyOnServiceCreateMember = jest.spyOn(service, 'createMember');
      spyOnServiceConnectMemberToUser = jest.spyOn(service, 'connectMemberToUser');
    });

    afterEach(() => {
      spyOnServiceCreateMember.mockReset();
      spyOnServiceConnectMemberToUser.mockReset();
    });

    it('should successfully handle a new user', async () => {
      spyOnServiceCreateMember.mockImplementationOnce(() => true);
      spyOnServiceConnectMemberToUser.mockImplementation(() => true);

      const users = [mockGenerateUser(), mockGenerateUser()];
      const member = mockGenerateMember();
      await resolver.handleNewMember({ member, users });

      expect(spyOnServiceCreateMember).toBeCalledWith(member);
      expect(spyOnServiceConnectMemberToUser).toBeCalledTimes(2);
      expect(spyOnServiceConnectMemberToUser).toBeCalledWith(member, users[0]);
      expect(spyOnServiceConnectMemberToUser).toBeCalledWith(member, users[1]);
    });
  });

  describe('get', () => {
    let spyOnServiceGet;
    beforeEach(() => {
      spyOnServiceGet = jest.spyOn(service, 'get');
    });

    afterEach(() => {
      spyOnServiceGet.mockReset();
    });

    it('should successfully return a communication object', async () => {
      const payload = {
        userId: v4(),
        memberId: generateId(),
        sendbirdChannelUrl: faker.datatype.uuid(),
      };
      spyOnServiceGet.mockImplementationOnce(() => payload);

      const params = generateGetCommunicationParams();
      const result = await resolver.getCommunication(params);

      const link = (id) => {
        return `${config.get('hosts.chat')}/?uid=${id}&mid=${payload.sendbirdChannelUrl}`;
      };

      expect(result).toEqual({
        userId: payload.userId,
        memberId: payload.memberId,
        chat: { memberLink: link(payload.memberId), userLink: link(payload.userId) },
      });

      expect(spyOnServiceGet).toBeCalledWith(params);
    });

    it('should return null on no communication of user and member', async () => {
      spyOnServiceGet.mockImplementationOnce(() => null);

      const params = generateGetCommunicationParams();
      const result = await resolver.getCommunication(params);

      expect(spyOnServiceGet).toBeCalledWith(params);
      expect(result).toBeNull();
    });
  });
});
