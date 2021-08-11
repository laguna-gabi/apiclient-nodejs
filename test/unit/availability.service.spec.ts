import { Test, TestingModule } from '@nestjs/testing';
import { DbModule } from '../../src/db/db.module';
import { Model, model } from 'mongoose';
import {
  dbConnect,
  dbDisconnect,
  generateAvailabilityInput,
  generateCreateRawUserParams,
  generateId,
} from '../index';
import {
  Availability,
  AvailabilityDto,
  AvailabilityModule,
  AvailabilityService,
} from '../../src/availability';
import { User, UserDto } from '../../src/user';
import { Errors, ErrorType } from '../../src/common';

describe('AvailabilityService', () => {
  let module: TestingModule;
  let service: AvailabilityService;
  let availabilityModel: Model<typeof AvailabilityDto>;
  let modelUser: Model<typeof UserDto>;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [DbModule, AvailabilityModule],
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
      const params = generateAvailabilityInput();
      const { ids } = await service.create([params]);

      const result: any = await availabilityModel.findById(ids[0]);
      expect(result.userId.toString()).toEqual(params.userId);
      expect(result.start).toEqual(params.start);
      expect(result.end).toEqual(params.end);
    });

    /* eslint-disable max-len*/
    it('should create multiple availability for the same user, regardless of time overlapping', async () => {
      /* eslint-enable max-len*/
      const userId = generateId();

      const params = [
        generateAvailabilityInput({ userId }),
        generateAvailabilityInput({ userId }),
        generateAvailabilityInput({ userId }),
      ];

      const createResult = await service.create(params);
      expect(createResult.ids.length).toEqual(params.length);

      const result = await availabilityModel.find({ userId });
      expect(result.length).toEqual(params.length);
    });

    /* eslint-disable max-len*/
    it('should create multiple availability for the multiple users, regardless of time overlapping', async () => {
      /* eslint-enable max-len*/
      const userId1 = generateId();
      const userId2 = generateId();

      const params1 = [
        generateAvailabilityInput({ userId: userId1 }),
        generateAvailabilityInput({ userId: userId1 }),
      ];
      const params2 = [generateAvailabilityInput({ userId: userId2 })];
      await service.create(params1);
      await service.create(params2);

      const result1 = await availabilityModel.find({ userId: userId1 });
      expect(result1.length).toEqual(2);
      const result2 = await availabilityModel.find({ userId: userId2 });
      expect(result2.length).toEqual(1);
    });
  });

  describe('get', () => {
    it('should sort availabilities in ascending order', async () => {
      const userId = generateId();

      const params = [
        generateAvailabilityInput({ userId }),
        generateAvailabilityInput({ userId }),
        generateAvailabilityInput({ userId }),
      ];
      await service.create(params);

      const result = await service.get();

      const isSorted = result
        .map((availability) => availability.start)
        .every((cur, index, arr) => !index || arr[index - 1].getTime() <= cur.getTime());

      expect(isSorted).toBeTruthy();
    });

    it('should get availabilities of at least 2 users', async () => {
      const { _id: userId1 } = await modelUser.create(generateCreateRawUserParams());
      const { _id: userId2 } = await modelUser.create(generateCreateRawUserParams());

      const params1 = [
        generateAvailabilityInput({ userId: userId1 }),
        generateAvailabilityInput({ userId: userId1 }),
      ];
      const params2 = [generateAvailabilityInput({ userId: userId2 })];
      await service.create(params1);
      await service.create(params2);

      const allResult = await service.get();
      const filtered = allResult.filter(
        (result) => result.userId === userId1 || result.userId === userId2,
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
      const { ids } = await service.create([params]);

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
    const { ids } = await service.create([params]);

    const result: any = await availabilityModel.findById(ids[0]);

    expect(result.createdAt).toEqual(expect.any(Date));
    expect(result.updatedAt).toEqual(expect.any(Date));
  });
});
