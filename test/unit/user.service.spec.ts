import { Test, TestingModule } from '@nestjs/testing';
import { DbModule } from '../../src/db/db.module';
import { Model, model } from 'mongoose';
import {
  defaultUserParams,
  User,
  UserDto,
  UserModule,
  UserRole,
  UserService,
} from '../../src/user';
import { compareUsers, dbConnect, dbDisconnect, generateCreateUserParams } from '../index';
import { Errors, ErrorType } from '../../src/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { AppointmentModule } from '../../src/appointment';
import { v4 } from 'uuid';

describe('UserService', () => {
  let module: TestingModule;
  let service: UserService;
  let userModel: Model<typeof UserDto>;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [DbModule, AppointmentModule, UserModule, EventEmitterModule.forRoot()],
    }).compile();

    service = module.get<UserService>(UserService);

    userModel = model(User.name, UserDto);

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

      const { id } = await service.insert(user);
      const result = await service.get(id);

      compareUsers(result, {
        ...user,
        languages: defaultUserParams.languages,
        maxCustomers: defaultUserParams.maxCustomers,
      });
    });

    it('should fail to insert an already existing user', async () => {
      const user = generateCreateUserParams();
      await service.insert(user);

      await expect(service.insert(user)).rejects.toThrow(
        Errors.get(ErrorType.userIdOrEmailAlreadyExists),
      );
    });
  });
});
