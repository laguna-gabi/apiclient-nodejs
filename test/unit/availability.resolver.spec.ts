import { Test, TestingModule } from '@nestjs/testing';
import { v4 } from 'uuid';
import {
  AvailabilityModule,
  AvailabilityResolver,
  AvailabilityService,
} from '../../src/availability';
import { dbDisconnect, defaultModules, generateAvailabilityInput, generateId } from '../index';

describe('AvailabilityResolver', () => {
  let module: TestingModule;
  let resolver: AvailabilityResolver;
  let service: AvailabilityService;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: defaultModules().concat(AvailabilityModule),
    }).compile();

    resolver = module.get<AvailabilityResolver>(AvailabilityResolver);
    service = module.get<AvailabilityService>(AvailabilityService);
  });

  afterAll(async () => {
    await module.close();
    await dbDisconnect();
  });

  describe('createAvailabilities', () => {
    let spyOnServiceCreate;
    beforeEach(() => {
      spyOnServiceCreate = jest.spyOn(service, 'create');
    });

    afterEach(() => {
      spyOnServiceCreate.mockReset();
    });

    it('should successfully create availabilities', async () => {
      const params = generateAvailabilityInput();
      spyOnServiceCreate.mockImplementationOnce(async () => undefined);
      const userId = v4();
      const token = {
        req: {
          user: {
            _id: userId,
          },
        },
      };

      await resolver.createAvailabilities(token, [params]);

      expect(spyOnServiceCreate).toBeCalledTimes(1);
      expect(spyOnServiceCreate).toBeCalledWith([params], userId);
    });
  });

  describe('getAvailabilities', () => {
    let spyOnServiceGet;
    beforeEach(() => {
      spyOnServiceGet = jest.spyOn(service, 'get');
    });

    afterEach(() => {
      spyOnServiceGet.mockReset();
    });

    it('should successfully get availabilities', async () => {
      spyOnServiceGet.mockImplementationOnce(async () => undefined);

      await resolver.getAvailabilities();

      expect(spyOnServiceGet).toBeCalledTimes(1);
      expect(spyOnServiceGet).toBeCalledWith();
    });
  });

  describe('deleteAvailability', () => {
    let spyOnServiceDelete;
    beforeEach(() => {
      spyOnServiceDelete = jest.spyOn(service, 'delete');
    });

    afterEach(() => {
      spyOnServiceDelete.mockReset();
    });

    it('should successfully delete an availability', async () => {
      spyOnServiceDelete.mockImplementationOnce(async () => undefined);

      const id = generateId();
      await resolver.deleteAvailability(id);

      expect(spyOnServiceDelete).toBeCalledTimes(1);
      expect(spyOnServiceDelete).toBeCalledWith(id);
    });
  });
});
