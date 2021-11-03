import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { Model, Types, model } from 'mongoose';
import { v4 } from 'uuid';
import { AppointmentModule } from '../../src/appointment';
import {
  ErrorType,
  Errors,
  IEventNewAppointment,
  IEventUpdateAppointmentsInUser,
} from '../../src/common';
import {
  NotNullableUserKeys,
  User,
  UserDto,
  UserModule,
  UserRole,
  UserService,
  defaultUserParams,
} from '../../src/user';
import {
  compareUsers,
  dbConnect,
  dbDisconnect,
  defaultModules,
  generateCreateUserParams,
  generateId,
  generateScheduleAppointmentParams,
} from '../index';

describe('UserService', () => {
  let module: TestingModule;
  let service: UserService;
  let mockUserModel;
  let userModel: Model<typeof UserDto>;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: defaultModules().concat(UserModule, AppointmentModule),
      providers: [{ provide: getModelToken(User.name), useValue: Model }],
    }).compile();

    service = module.get<UserService>(UserService);

    userModel = model(User.name, UserDto);
    mockUserModel = module.get<Model<User>>(getModelToken(User.name));

    await dbConnect();
  });

  afterAll(async () => {
    await module.close();
    await dbDisconnect();
  });

  describe('get+insert', () => {
    it('should return null for non existing user', async () => {
      const result = await service.get(v4());
      expect(result).toBeNull();
    });

    it('should get the two or more users users created', async () => {
      const user1 = generateCreateUserParams();
      await service.insert(user1);
      const user2 = generateCreateUserParams();
      await service.insert(user2);

      const result = await service.getUsers();
      expect(result.length).toBeGreaterThanOrEqual(2);
    });

    test.each([
      [Object.values(UserRole)],
      [[UserRole.coach, UserRole.nurse]],
      [[UserRole.coach]],
      [[UserRole.nurse]],
      [[UserRole.admin]],
    ])('should successfully insert a user having roles : %p', async (roles) => {
      const user = generateCreateUserParams({ roles });

      const { id } = await service.insert(user);
      const result = await service.get(id);

      compareUsers(result, user);
    });

    it('should check that createdAt and updatedAt exists in the collection', async () => {
      const user = generateCreateUserParams();

      const { id } = await service.insert(user);
      const createdUser: any = await userModel.findById(id);

      expect(createdUser.createdAt).toEqual(expect.any(Date));
      expect(createdUser.updatedAt).toEqual(expect.any(Date));
    });

    it('should insert a user without optional params + validate all fields', async () => {
      const user = generateCreateUserParams();
      delete user.title;
      delete user.languages;
      delete user.maxCustomers;
      delete user.roles;
      delete user.avatar;
      delete user.description;

      const { id } = await service.insert(user);
      const result = await service.get(id);

      compareUsers(result, {
        ...user,
        languages: defaultUserParams.languages,
        maxCustomers: defaultUserParams.maxCustomers,
        roles: defaultUserParams.roles,
        avatar: defaultUserParams.avatar,
      });
    });

    it('should remove not nullable optional params if null is passed', async () => {
      const user = generateCreateUserParams();
      NotNullableUserKeys.forEach((key) => {
        user[key] = null;
      });

      const { id } = await service.insert(user);
      const result = await service.get(id);

      NotNullableUserKeys.forEach((key) => {
        expect(result).not.toHaveProperty(key, null);
      });
    });

    it('should fail to insert an already existing user', async () => {
      const user = generateCreateUserParams();
      await service.insert(user);

      await expect(service.insert(user)).rejects.toThrow(
        Errors.get(ErrorType.userIdOrEmailAlreadyExists),
      );
    });

    it.each([
      {
        users: [
          { _id: 'test1', members: 0, lastMemberAssignedAt: new Date(0), maxCustomers: 1 },
          { _id: 'test2', members: 0, lastMemberAssignedAt: new Date(1), maxCustomers: 1 },
          { _id: 'test3', members: 0, lastMemberAssignedAt: new Date(2), maxCustomers: 1 },
        ],
        userId: 'test1',
      },
      {
        users: [
          { _id: 'test1', members: 1, lastMemberAssignedAt: new Date(0), maxCustomers: 1 },
          { _id: 'test2', members: 0, lastMemberAssignedAt: new Date(1), maxCustomers: 1 },
          { _id: 'test3', members: 0, lastMemberAssignedAt: new Date(2), maxCustomers: 1 },
        ],
        userId: 'test2',
      },
      {
        users: [
          { _id: 'test1', members: 1, lastMemberAssignedAt: new Date(0), maxCustomers: 1 },
          { _id: 'test2', members: 1, lastMemberAssignedAt: new Date(1), maxCustomers: 1 },
          { _id: 'test3', members: 0, lastMemberAssignedAt: new Date(2), maxCustomers: 1 },
        ],
        userId: 'test3',
      },
      {
        users: [
          { _id: 'test1', members: 1, lastMemberAssignedAt: new Date(0), maxCustomers: 1 },
          { _id: 'test2', members: 0, lastMemberAssignedAt: new Date(1), maxCustomers: 1 },
          { _id: 'test3', members: 1, lastMemberAssignedAt: new Date(2), maxCustomers: 1 },
        ],
        userId: 'test2',
      },
      {
        users: [
          { _id: 'test1', members: 1, lastMemberAssignedAt: new Date(0), maxCustomers: 1 },
          { _id: 'test2', members: 1, lastMemberAssignedAt: new Date(1), maxCustomers: 1 },
          { _id: 'test3', members: 1, lastMemberAssignedAt: new Date(2), maxCustomers: 1 },
        ],
        userId: 'test1',
      },
    ])('should get available user', async ({ users, userId }) => {
      jest.spyOn(mockUserModel, 'aggregate').mockResolvedValue(users);
      const result = await service.getAvailableUser();
      expect(result).toEqual(userId);
    });
  });

  describe('userConfig', () => {
    it('should create userConfig on userCreate', async () => {
      const user = generateCreateUserParams();
      const createdUser = await service.insert(user);
      const CreatedConfigUser = await service.getUserConfig(createdUser.id);

      expect(createdUser.id).toEqual(CreatedConfigUser.userId);
    });
  });

  describe('updateUserAppointments', () => {
    it('should move appointments from old user to new user', async () => {
      const oldUser = await service.insert(generateCreateUserParams());
      const newUser = await service.insert(generateCreateUserParams());

      // Insert appointments to oldUser
      const mockAppointments = [];
      for (let step = 0; step < 5; step++) {
        const appointment = generateScheduleAppointmentParams({ id: generateId() });
        mockAppointments.push(appointment);
        const params: IEventNewAppointment = {
          appointmentId: appointment.id,
          userId: oldUser.id,
        };
        await service.handleOrderCreatedEvent(params);
      }
      const params: IEventUpdateAppointmentsInUser = {
        newUserId: newUser.id,
        oldUserId: oldUser.id,
        memberId: generateId(),
        appointments: mockAppointments,
      };

      await service.updateUserAppointments(params);

      // Not using service.get because it populates the appointments, and they don't really exist
      const updatedOldUser = (await userModel.findById(oldUser.id)).toObject();
      const updatedNewUser = (await userModel.findById(newUser.id)).toObject();
      const mockAppointmentsIds = mockAppointments.map((app) => Types.ObjectId(app.id));

      expect(updatedNewUser['appointments']).toEqual(mockAppointmentsIds);
      expect(updatedOldUser['appointments']).toEqual([]);
    });
  });
});
