import { mockLogger, mockProcessWarnings } from '@argus/pandora';
import { Test, TestingModule } from '@nestjs/testing';
import { Model, Types, model } from 'mongoose';
import {
  checkDelete,
  dbConnect,
  dbDisconnect,
  defaultModules,
  generateAvailabilityInput,
  generateCreateUserParams,
  generateId,
} from '..';
import {
  Availability,
  AvailabilityDocument,
  AvailabilityDto,
  AvailabilityModule,
  AvailabilityService,
} from '../../src/availability';
import { ErrorType, Errors, LoggerService, defaultTimestampsDbValues } from '../../src/common';
import { User, UserDocument, UserDto } from '../../src/user';

describe('AvailabilityService', () => {
  let module: TestingModule;
  let service: AvailabilityService;
  let availabilityModel: Model<AvailabilityDocument & defaultTimestampsDbValues>;
  let modelUser: Model<UserDocument>;

  beforeAll(async () => {
    mockProcessWarnings(); // to hide pino prettyPrint warning
    module = await Test.createTestingModule({
      imports: defaultModules().concat(AvailabilityModule),
    }).compile();

    service = module.get<AvailabilityService>(AvailabilityService);
    mockLogger(module.get<LoggerService>(LoggerService));

    availabilityModel = model<AvailabilityDocument & defaultTimestampsDbValues>(
      Availability.name,
      AvailabilityDto,
    );
    modelUser = model<UserDocument>(User.name, UserDto);

    await dbConnect();
  });

  afterAll(async () => {
    await module.close();
    await dbDisconnect();
  });

  describe('create', () => {
    it('should create an availability', async () => {
      const userId = generateId();
      const params = generateAvailabilityInput();
      const { ids } = await service.create([params], userId);

      const result = await availabilityModel.findById(ids[0]);
      expect(result.userId.toString()).toEqual(userId);
      expect(result.start).toEqual(params.start);
      expect(result.end).toEqual(params.end);
    });

    /* eslint-disable-next-line max-len */
    it('should create multiple availability for the same user, regardless of time overlapping', async () => {
      const userId = generateId();

      const params = [
        generateAvailabilityInput(),
        generateAvailabilityInput(),
        generateAvailabilityInput(),
      ];

      const createResult = await service.create(params, userId);
      expect(createResult.ids.length).toEqual(params.length);

      const result = await availabilityModel.find({ userId: new Types.ObjectId(userId) });
      expect(result.length).toEqual(params.length);
    });

    /* eslint-disable-next-line max-len */
    it('should create multiple availability for the multiple users, regardless of time overlapping', async () => {
      const userId1 = generateId();
      const userId2 = generateId();

      const params1 = [generateAvailabilityInput(), generateAvailabilityInput()];
      const params2 = [generateAvailabilityInput()];
      await service.create(params1, userId1);
      await service.create(params2, userId2);

      const result1 = await availabilityModel.find({ userId: new Types.ObjectId(userId1) });
      expect(result1.length).toEqual(2);
      const result2 = await availabilityModel.find({ userId: new Types.ObjectId(userId2) });
      expect(result2.length).toEqual(1);
    });
  });

  describe('get', () => {
    it('should sort availabilities in ascending order', async () => {
      const userId = generateId();

      const params = [
        generateAvailabilityInput(),
        generateAvailabilityInput(),
        generateAvailabilityInput(),
      ];
      await service.create(params, userId);

      const result = await service.get();

      const isSorted = result
        .map((availability) => availability.start)
        .every((cur, index, arr) => !index || arr[index - 1].getTime() <= cur.getTime());

      expect(isSorted).toBeTruthy();
    });

    it('should get availabilities of at least 2 users', async () => {
      const user1 = await modelUser.create(generateCreateUserParams());
      const user2 = await modelUser.create(generateCreateUserParams());

      const params1 = [generateAvailabilityInput(), generateAvailabilityInput()];
      const params2 = [generateAvailabilityInput()];
      await service.create(params1, user1.id);
      await service.create(params2, user2.id);

      const allResult = await service.get();
      const filtered = allResult.filter(
        (result) => result.userId.toString() === user1.id || result.userId.toString() === user2.id,
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
      const userId = generateId();

      const { ids } = await service.create([params], userId);

      let result = await availabilityModel.findById(ids[0]);
      expect(result).not.toBeNull();

      await service.delete(ids[0], userId);

      result = await availabilityModel.findById(ids[0]);
      expect(result).toBeNull();

      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      const deletedResult = await availabilityModel.findWithDeleted({
        _id: new Types.ObjectId(ids[0]),
      });
      checkDelete(deletedResult, { _id: new Types.ObjectId(ids[0]) }, userId);
    });

    it('should throw exception when trying to delete a non existing availability', async () => {
      const id = generateId();
      await expect(service.delete(id, generateId())).rejects.toThrow(
        Errors.get(ErrorType.availabilityNotFound),
      );
    });
  });

  it('should check that createdAt and updatedAt exists in the collection', async () => {
    const params = generateAvailabilityInput();
    const userId = generateId();

    const { ids } = await service.create([params], userId);

    const result = await availabilityModel.findById(ids[0]);
    expect(result.createdAt).toEqual(expect.any(Date));
    expect(result.updatedAt).toEqual(expect.any(Date));
  });

  it('should not get a deleted availability', async () => {
    const user = await modelUser.create(generateCreateUserParams());

    const params1 = [generateAvailabilityInput(), generateAvailabilityInput()];
    const params2 = [generateAvailabilityInput(), generateAvailabilityInput()];
    const { ids: nonDeletedIds } = await service.create(params1, user.id);
    const { ids: deletedIds } = await service.create(params2, user.id);

    await Promise.all(
      deletedIds.map(async (id) => {
        await service.delete(id, user.id);
      }),
    );

    const allResult = await service.get();
    const filtered = allResult.filter((result) => result.userId.toString() === user.id);
    expect(filtered.length).toEqual(nonDeletedIds.length);
    expect(filtered).toEqual(
      expect.arrayContaining([
        expect.objectContaining(params1[0]),
        expect.objectContaining(params1[1]),
      ]),
    );
  });
});
