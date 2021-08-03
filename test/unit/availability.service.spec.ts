import { Test, TestingModule } from '@nestjs/testing';
import { DbModule } from '../../src/db/db.module';
import { Model, model, Types } from 'mongoose';
import { dbConnect, dbDisconnect, generateAvailabilityInput } from '../index';
import {
  Availability,
  AvailabilityDto,
  AvailabilityModule,
  AvailabilityService,
} from '../../src/availability';

describe('AvailabilityService', () => {
  let module: TestingModule;
  let service: AvailabilityService;
  let availabilityModel: Model<typeof AvailabilityDto>;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [DbModule, AvailabilityModule],
    }).compile();

    service = module.get<AvailabilityService>(AvailabilityService);

    availabilityModel = model(Availability.name, AvailabilityDto);

    await dbConnect();
  });

  afterAll(async () => {
    await module.close();
    await dbDisconnect();
  });

  describe('create', () => {
    it('should create an availability', async () => {
      const params = generateAvailabilityInput();
      await service.create([params]);

      const result = await availabilityModel.findOne({ userId: params.userId });
      expect(result).toEqual(expect.objectContaining(params));
    });

    /* eslint-disable max-len*/
    it('should create multiple availability for the same user, regardless of time overlapping', async () => {
      /* eslint-enable max-len*/
      const userId = new Types.ObjectId().toString();

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
      const userId1 = new Types.ObjectId().toString();
      const userId2 = new Types.ObjectId().toString();

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

  it('should check that createdAt and updatedAt exists in the collection', async () => {
    const params = generateAvailabilityInput();
    await service.create([params]);

    const result: any = await availabilityModel.findOne({
      userId: params.userId,
      start: params.start,
      end: params.end,
    });

    expect(result.createdAt).toEqual(expect.any(Date));
    expect(result.updatedAt).toEqual(expect.any(Date));
  });
});
