import { mockLogger, mockProcessWarnings } from '@lagunahealth/pandora';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Model } from 'mongoose';
import { generateDispatch } from '../.';
import { AppModule } from '../../src/app.module';
import { LoggerService } from '../../src/common';
import { Dispatch, DispatchStatus, DispatchesController } from '../../src/conductor';
import { getModelToken } from '@nestjs/mongoose';
import { datatype } from 'faker';

describe('Dispatches Controller', () => {
  let controller: DispatchesController;
  let mockDispatchesModelFind: jest.SpyInstance;
  let module: TestingModule;
  let app: INestApplication;
  let dispatchesModel: Model<Dispatch>;

  beforeAll(async () => {
    mockProcessWarnings();
    module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();

    controller = module.get<DispatchesController>(DispatchesController);
    dispatchesModel = module.get<Model<Dispatch>>(getModelToken(Dispatch.name));
    mockLogger(module.get<LoggerService>(LoggerService));

    mockDispatchesModelFind = jest.spyOn(dispatchesModel, 'find');
  }, 10000);

  afterEach(async () => {
    mockDispatchesModelFind.mockReset();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should be defined', async () => {
    expect(controller).toBeDefined();
  });

  test.each([
    [
      'non-empty projection',
      datatype.string(24),
      DispatchStatus.done,
      ['field1', `filed2`],
      { status: DispatchStatus.done },
      { field1: 1, filed2: 1 },
    ],
    [
      'empty projection',
      datatype.string(24),
      DispatchStatus.acquired,
      undefined,
      { status: DispatchStatus.acquired },
      undefined,
    ],
    [
      'empty status and projection',
      datatype.string(24),
      undefined,
      undefined,
      { status: DispatchStatus.done },
      undefined,
    ],
  ])(
    '[%p] should call `find` with correct filter and projection values',
    async (_, senderClientId, status, projection, expectedFilter, expectedProjection) => {
      const dispatch = generateDispatch();

      mockDispatchesModelFind.mockResolvedValue([dispatch]);

      const dispatches = await controller.getBySenderClientId(senderClientId, status, projection);

      expect(mockDispatchesModelFind).toBeCalledWith(
        { ...expectedFilter, senderClientId: senderClientId },
        { ...expectedProjection, ...{ _id: 0 } },
        { lean: true },
      );
      expect(dispatches).toEqual([dispatch]);
    },
  );
});
