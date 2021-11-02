import { Test, TestingModule } from '@nestjs/testing';
import { Model, model } from 'mongoose';
import { v4 } from 'uuid';
import {
  Availability,
  AvailabilityDto,
  AvailabilityModule,
  AvailabilityService,
} from '../../src/availability';
import { ErrorType, Errors } from '../../src/common';
import { User, UserDto } from '../../src/user';
import {
  dbConnect,
  dbDisconnect,
  defaultModules,
  generateAvailabilityInput,
  generateCreateRawUserParams,
  generateId,
} from '../index';

describe('AvailabilityService', () => {
  let module: TestingModule;
  let service: AvailabilityService;
  let availabilityModel: Model<typeof AvailabilityDto>;
  let modelUser: Model<typeof UserDto>;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: defaultModules().concat(AvailabilityModule),
    }).compile();

    service = module.get<AvailabilityService>(AvailabilityService);

    availabilityModel = model(Availability.name, AvailabilityDto);
    modelUser = model(User.name, UserDto);

    await dbConnect();
  });

  afterAll(async () => {
    await module.close();
    await dbDisconnect();
  });

  describe('create', () => {
    it('should create an availability', async () => {
      const userId = v4();
      const params = generateAvailabilityInput();
      const { ids } = await service.create([params], userId);

      const result: any = await availabilityModel.findById(ids[0]);
      expect(result.userId).toEqual(userId);
      expect(result.start).toEqual(params.start);
      expect(result.end).toEqual(params.end);
    });

    /* eslint-disable max-len*/
    it('should create multiple availability for the same user, regardless of time overlapping', async () => {
      /* eslint-enable max-len*/
      const userId = v4();

      const params = [
        generateAvailabilityInput(),
        generateAvailabilityInput(),
        generateAvailabilityInput(),
      ];

      const createResult = await service.create(params, userId);
      expect(createResult.ids.length).toEqual(params.length);

      const result = await availabilityModel.find({ userId });
      expect(result.length).toEqual(params.length);
    });

    /* eslint-disable max-len*/
    it('should create multiple availability for the multiple users, regardless of time overlapping', async () => {
      /* eslint-enable max-len*/
      const userId1 = v4();
      const userId2 = v4();

      const params1 = [generateAvailabilityInput(), generateAvailabilityInput()];
      const params2 = [generateAvailabilityInput()];
      await service.create(params1, userId1);
      await service.create(params2, userId2);

      const result1 = await availabilityModel.find({ userId: userId1 });
      expect(result1.length).toEqual(2);
      const result2 = await availabilityModel.find({ userId: userId2 });
      expect(result2.length).toEqual(1);
    });
  });

  describe('get', () => {
    it('should sort availabilities in ascending order', async () => {
      const userAuthId = v4();

      const params = [
        generateAvailabilityInput(),
        generateAvailabilityInput(),
        generateAvailabilityInput(),
      ];
      await service.create(params, userAuthId);

      const result = await service.get();

      const isSorted = result
        .map((availability) => availability.start)
        .every((cur, index, arr) => !index || arr[index - 1].getTime() <= cur.getTime());

      expect(isSorted).toBeTruthy();
    });

    it('should get availabilities of at least 2 users', async () => {
      const user1 = await modelUser.create(generateCreateRawUserParams());
      const user2 = await modelUser.create(generateCreateRawUserParams());

      const params1 = [generateAvailabilityInput(), generateAvailabilityInput()];
      const params2 = [generateAvailabilityInput()];
      await service.create(params1, user1.id);
      await service.create(params2, user2.id);

      const allResult = await service.get();
      const filtered = allResult.filter(
        (result) => result.userId === user1.id || result.userId === user2.id,
      );

      expect(filtered.length).toEqual(params1.length + params2.length);
      expect(filtered).toEqual(
        expect.arrayContaining([
          expect.objectContaining(params1[0]),
          expect.objectContaining(params1[1]),
          expect.objectContaining(params2[0]),
        ]),
      );
    });

    it('should not take longer than 0.5 seconds to fetch availabilities', async () => {
      await service.get();
    }, 500);
  });

  describe('delete', () => {
    it('should successfully delete an availability', async () => {
      const params = generateAvailabilityInput();
      const userAuthId = v4();

      const { ids } = await service.create([params], userAuthId);

      let result = await availabilityModel.findById(ids[0]);
      expect(result).not.toBeNull();

      await service.delete(ids[0]);

      result = await availabilityModel.findById(ids[0]);
      expect(result).toBeNull();
    });

    it('should throw exception when trying to delete a non existing availability', async () => {
      const id = generateId();
      await expect(service.delete(id)).rejects.toThrow(Errors.get(ErrorType.availabilityNotFound));
    });
  });

  it('should check that createdAt and updatedAt exists in the collection', async () => {
    const params = generateAvailabilityInput();
    const userAuthId = v4();

    const { ids } = await service.create([params], userAuthId);

    const result: any = await availabilityModel.findById(ids[0]);

    expect(result.createdAt).toEqual(expect.any(Date));
    expect(result.updatedAt).toEqual(expect.any(Date));
  });
});
