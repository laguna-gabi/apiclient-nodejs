import { mockLogger, mockProcessWarnings } from '@argus/pandora';
import { Test, TestingModule } from '@nestjs/testing';
import {
  defaultModules,
  generateCreateMobileVersionParams,
  generateUpdateFaultyMobileVersionsParams,
  generateUpdateMinMobileVersionParams,
} from '..';
import { LoggerService } from '../../src/common';
import {
  ConfigurationModule,
  CreateMobileVersionParams,
  MobileVersionResolver,
  MobileVersionService,
  UpdateFaultyMobileVersionsParams,
  UpdateMinMobileVersionParams,
} from '../../src/configuration';

describe('MobileVersionResolver', () => {
  let module: TestingModule;
  let resolver: MobileVersionResolver;
  let service: MobileVersionService;

  beforeAll(async () => {
    mockProcessWarnings(); // to hide pino prettyPrint warning
    module = await Test.createTestingModule({
      imports: defaultModules().concat(ConfigurationModule),
    }).compile();

    resolver = module.get<MobileVersionResolver>(MobileVersionResolver);
    service = module.get<MobileVersionService>(MobileVersionService);
    mockLogger(module.get<LoggerService>(LoggerService));
  });

  afterAll(async () => {
    await module.close();
  });

  describe('createMobileVersion', () => {
    let spyOnServiceCreateMobileVersion;

    beforeEach(() => {
      spyOnServiceCreateMobileVersion = jest.spyOn(service, 'createMobileVersion');
    });

    afterEach(() => {
      spyOnServiceCreateMobileVersion.mockReset();
    });

    it('should create mobile version', async () => {
      const createMobileVersionParams: CreateMobileVersionParams =
        generateCreateMobileVersionParams();
      spyOnServiceCreateMobileVersion.mockImplementationOnce(() => null);

      const result = await resolver.createMobileVersion(createMobileVersionParams);

      expect(spyOnServiceCreateMobileVersion).toBeCalledTimes(1);
      expect(spyOnServiceCreateMobileVersion).toBeCalledWith(createMobileVersionParams);
      expect(result).toBeNull();
    });
  });

  describe('updateMinMobileVersion', () => {
    let spyOnServiceUpdateMinMobileVersion;

    beforeEach(() => {
      spyOnServiceUpdateMinMobileVersion = jest.spyOn(service, 'updateMinMobileVersion');
    });

    afterEach(() => {
      spyOnServiceUpdateMinMobileVersion.mockReset();
    });

    it('should update min mobile version', async () => {
      const updateMinMobileVersionParams: UpdateMinMobileVersionParams =
        generateUpdateMinMobileVersionParams();
      spyOnServiceUpdateMinMobileVersion.mockImplementationOnce(() => null);

      const result = await resolver.updateMinMobileVersion(updateMinMobileVersionParams);

      expect(spyOnServiceUpdateMinMobileVersion).toBeCalledTimes(1);
      expect(spyOnServiceUpdateMinMobileVersion).toBeCalledWith(updateMinMobileVersionParams);
      expect(result).toBeNull();
    });
  });

  describe('updateFaultyMobileVersions', () => {
    let spyOnServiceUpdateFaultyMobileVersions;
    beforeEach(() => {
      spyOnServiceUpdateFaultyMobileVersions = jest.spyOn(service, 'updateFaultyMobileVersions');
    });

    afterEach(() => {
      spyOnServiceUpdateFaultyMobileVersions.mockReset();
    });

    it('should successfully get org by id', async () => {
      const updateFaultyMobileVersionsParams: UpdateFaultyMobileVersionsParams =
        generateUpdateFaultyMobileVersionsParams();
      spyOnServiceUpdateFaultyMobileVersions.mockImplementationOnce(() => null);

      const result = await resolver.updateFaultyMobileVersions(updateFaultyMobileVersionsParams);

      expect(spyOnServiceUpdateFaultyMobileVersions).toBeCalledTimes(1);
      expect(spyOnServiceUpdateFaultyMobileVersions).toBeCalledWith(
        updateFaultyMobileVersionsParams,
      );
      expect(result).toBeNull();
    });
  });
});
