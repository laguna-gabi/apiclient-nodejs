import { Test, TestingModule } from '@nestjs/testing';
import { DbModule } from '../../src/db/db.module';
import * as mongoose from 'mongoose';
import { User, UserRole, UserDto } from '../../src/user/user.dto';
import { ObjectID } from 'bson';
import { Errors } from '../../src/common';
import { UserService } from '../../src/user/user.service';
import { UserModule } from '../../src/user/user.module';
import { connectToDb, generateCreateUserParams } from '../index';

describe('UserService', () => {
  let service: UserService;
  let model: mongoose.Model<typeof UserDto>;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [DbModule, UserModule],
    }).compile();

    service = module.get<UserService>(UserService);

    model = mongoose.model(User.name, UserDto);

    await connectToDb();
  });

  describe('get', () => {
    it('should return null for non existing user', async () => {
      const id = new ObjectID();
      const result = await service.get(id.toString());
      expect(result).toBeNull();
    });

    it('should return user object for an existing user', async () => {
      const user = generateCreateUserParams();
      const { id } = await model.create(user);

      const result = await service.get(id);
      expect(result.email).toEqual(user.email);
      expect(result.roles).toEqual(expect.arrayContaining(user.roles));
    });
  });

  describe('insert', () => {
    test.each([
      [Object.values(UserRole)],
      [[UserRole.coach, UserRole.nurse]],
      [[UserRole.coach]],
      [[UserRole.nurse]],
      [[UserRole.admin]],
    ])('should successfully insert a user having roles : %p', async (roles) => {
      const user = generateCreateUserParams({ roles });
      const { id } = await service.insert(user);

      const createdUser = await model.findById(id);
      expect(createdUser['email']).toEqual(user.email);
      expect(createdUser['roles']).toEqual(expect.arrayContaining(user.roles));

      expect(id).not.toBeNull();
    });

    it('should check that createdAt and updatedAt exists in the collection', async () => {
      const user = generateCreateUserParams();
      const { id } = await service.insert(user);

      const createdUser = await model.findById(id);
      expect(createdUser['createdAt']).toEqual(expect.any(Date));
      expect(createdUser['updatedAt']).toEqual(expect.any(Date));
    });

    it('should fail to insert an already existing user', async () => {
      const user = generateCreateUserParams();
      await service.insert(user);

      await expect(service.insert(user)).rejects.toThrow(
        `${Errors.user.create.title} : ${Errors.user.create.reasons.email}`,
      );
    });
  });
});
