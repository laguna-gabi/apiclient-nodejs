import { Platform, mockLogger, mockProcessWarnings } from '@argus/pandora';
import { Test, TestingModule } from '@nestjs/testing';
import { Model, model } from 'mongoose';
import {
  dbConnect,
  dbDisconnect,
  defaultModules,
  generateCreateMobileVersionParams,
  generateUpdateFaultyMobileVersionsParams,
  generateUpdateMinMobileVersionParams,
} from '..';
import { ErrorType, Errors, LoggerService } from '../../src/common';
import {
  ConfigurationModule,
  CreateMobileVersionParams,
  MobileVersion,
  MobileVersionDocument,
  MobileVersionDto,
  MobileVersionService,
  UpdateFaultyMobileVersionsParams,
  UpdateMinMobileVersionParams,
} from '../../src/configuration';

describe('MobileVersionService', () => {
  let module: TestingModule;
  let service: MobileVersionService;
  let mobileVersionModel: Model<MobileVersionDocument>;

  beforeAll(async () => {
    mockProcessWarnings(); // to hide pino prettyPrint warning
    module = await Test.createTestingModule({
      imports: defaultModules().concat(ConfigurationModule),
    }).compile();

    service = module.get<MobileVersionService>(MobileVersionService);
    mockLogger(module.get<LoggerService>(LoggerService));

    mobileVersionModel = model<MobileVersionDocument>(MobileVersion.name, MobileVersionDto);

    await dbConnect();
  });

  afterAll(async () => {
    await module.close();
    await dbDisconnect();
  });

  describe('createMobileVersion', () => {
    it('should create new mobile version', async () => {
      const createMobileVersionParams: CreateMobileVersionParams =
        generateCreateMobileVersionParams();

      await service.createMobileVersion(createMobileVersionParams);

      const mobileVersion = await mobileVersionModel.findOne({
        version: createMobileVersionParams.version,
      });

      expect(mobileVersion).toEqual(
        expect.objectContaining({
          ...createMobileVersionParams,
          minVersion: false,
          faultyVersion: false,
        }),
      );
    });

    // eslint-disable-next-line max-len
    it('should make the new version minVersion:true if passed true and change old to minVersion:false', async () => {
      const createMobileVersionParamsOld: CreateMobileVersionParams =
        generateCreateMobileVersionParams({ minVersion: true });

      await service.createMobileVersion(createMobileVersionParamsOld);

      let mobileVersionOld = await mobileVersionModel.findOne({
        version: createMobileVersionParamsOld.version,
      });

      expect(mobileVersionOld).toEqual(
        expect.objectContaining({
          ...createMobileVersionParamsOld,
          minVersion: true,
          faultyVersion: false,
        }),
      );

      const createMobileVersionParamsNew: CreateMobileVersionParams =
        generateCreateMobileVersionParams({
          minVersion: true,
        });

      await service.createMobileVersion(createMobileVersionParamsNew);

      const mobileVersionNew = await mobileVersionModel.findOne({
        version: createMobileVersionParamsNew.version,
      });

      expect(mobileVersionNew).toEqual(
        expect.objectContaining({
          ...createMobileVersionParamsNew,
          minVersion: true,
          faultyVersion: false,
        }),
      );

      mobileVersionOld = await mobileVersionModel.findOne({
        version: createMobileVersionParamsOld.version,
      });

      expect(mobileVersionOld).toEqual(
        expect.objectContaining({
          ...createMobileVersionParamsOld,
          minVersion: false,
          faultyVersion: false,
        }),
      );
    });
  });

  describe('updateMinMobileVersion', () => {
    it('should update minVersion', async () => {
      const createMobileVersionParams1: CreateMobileVersionParams =
        generateCreateMobileVersionParams();
      await service.createMobileVersion(createMobileVersionParams1);

      const mobileVersion1 = await mobileVersionModel.findOne({
        version: createMobileVersionParams1.version,
      });

      expect(mobileVersion1).toEqual(
        expect.objectContaining({
          ...createMobileVersionParams1,
          minVersion: false,
          faultyVersion: false,
        }),
      );

      const createMobileVersionParams2: CreateMobileVersionParams =
        generateCreateMobileVersionParams({ minVersion: true });
      await service.createMobileVersion(createMobileVersionParams2);

      const mobileVersion2 = await mobileVersionModel.findOne({
        version: createMobileVersionParams2.version,
      });

      expect(mobileVersion2).toEqual(
        expect.objectContaining({
          ...createMobileVersionParams2,
          minVersion: true,
          faultyVersion: false,
        }),
      );

      const updateMinMobileVersionParams: UpdateMinMobileVersionParams =
        generateUpdateMinMobileVersionParams({
          version: createMobileVersionParams1.version,
          platform: createMobileVersionParams1.platform,
        });

      await service.updateMinMobileVersion(updateMinMobileVersionParams);

      const mobileVersion1AfterUpdate = await mobileVersionModel.findOne({
        version: createMobileVersionParams1.version,
      });

      expect(mobileVersion1AfterUpdate).toEqual(
        expect.objectContaining({
          ...createMobileVersionParams1,
          minVersion: true,
          faultyVersion: false,
        }),
      );
      const mobileVersion2AfterUpdate = await mobileVersionModel.findOne({
        version: createMobileVersionParams2.version,
      });

      expect(mobileVersion2AfterUpdate).toEqual(
        expect.objectContaining({
          ...createMobileVersionParams2,
          minVersion: false,
          faultyVersion: false,
        }),
      );
    });

    it('should throw an error if mobile version does not exist', async () => {
      const updateMinMobileVersionParams: UpdateMinMobileVersionParams =
        generateUpdateMinMobileVersionParams();

      await expect(service.updateMinMobileVersion(updateMinMobileVersionParams)).rejects.toThrow(
        Errors.get(ErrorType.configurationMobileVersionNotFound),
      );
    });
  });

  describe('updateFaultyMobileVersions', () => {
    it('should update faulty version', async () => {
      const params = [
        generateCreateMobileVersionParams({ platform: Platform.android }),
        generateCreateMobileVersionParams({ platform: Platform.android }),
        generateCreateMobileVersionParams({ platform: Platform.android }),
      ];

      await Promise.all(
        params.map(async (createMobileVersionParams) => {
          await service.createMobileVersion(createMobileVersionParams);

          const mobileVersion = await mobileVersionModel.findOne({
            version: createMobileVersionParams.version,
          });

          expect(mobileVersion).toEqual(
            expect.objectContaining({
              ...createMobileVersionParams,
              minVersion: false,
              faultyVersion: false,
            }),
          );
        }),
      );

      const updateFaultyVersionsParams: UpdateFaultyMobileVersionsParams =
        generateUpdateFaultyMobileVersionsParams({
          versions: params.map((createMobileVersionParams) => createMobileVersionParams.version),
          platform: Platform.android,
        });

      await service.updateFaultyMobileVersions(updateFaultyVersionsParams);

      await Promise.all(
        params.map(async (createMobileVersionParams) => {
          const mobileVersion = await mobileVersionModel.findOne({
            version: createMobileVersionParams.version,
          });

          expect(mobileVersion).toEqual(
            expect.objectContaining({
              ...createMobileVersionParams,
              minVersion: false,
              faultyVersion: true,
            }),
          );
        }),
      );
    });
  });
});
