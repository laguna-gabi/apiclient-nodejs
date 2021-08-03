import { Test, TestingModule } from '@nestjs/testing';
import { dbDisconnect, mockGenerateMember, mockGenerateUser } from '../index';
import { DbModule } from '../../src/db/db.module';
import { EventEmitterModule } from '@nestjs/event-emitter';
import {
  CommunicationModule,
  CommunicationResolver,
  CommunicationService,
} from '../../src/communication';

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
      const primaryCoach = mockGenerateUser();
      const member = mockGenerateMember();
      await resolver.handleNewMember({ member, users, primaryCoach });

      expect(spyOnServiceCreateMember).toBeCalledWith(member);
      expect(spyOnServiceConnectMemberToUser).toBeCalledTimes(3);
      expect(spyOnServiceConnectMemberToUser).toBeCalledWith(member, primaryCoach);
      expect(spyOnServiceConnectMemberToUser).toBeCalledWith(member, users[0]);
      expect(spyOnServiceConnectMemberToUser).toBeCalledWith(member, users[1]);
    });
  });
});
