import { Platform, mockLogger, mockProcessWarnings } from '@argus/pandora';
import { Test, TestingModule } from '@nestjs/testing';
import {
  defaultModules,
  generateCheckMobileVersionParams,
  generateMobileVersion,
  mockGenerateCheckMobileVersionResponse,
} from '..';
import { LoggerService } from '../../src/common';
import {
  ConfigurationController,
  ConfigurationModule,
  MobileVersionService,
} from '../../src/configuration';

describe('ConfigurationController', () => {
  let module: TestingModule;
  let controller: ConfigurationController;
  let mobileVersionService: MobileVersionService;

  beforeAll(async () => {
    mockProcessWarnings(); // to hide pino prettyPrint warning
    module = await Test.createTestingModule({
      imports: defaultModules().concat(ConfigurationModule),
    }).compile();

    controller = module.get<ConfigurationController>(ConfigurationController);
    mobileVersionService = module.get<MobileVersionService>(MobileVersionService);
    mockLogger(module.get<LoggerService>(LoggerService));
  });

  afterAll(async () => {
    await module.close();
  });

  describe('mobile version', () => {
    describe('check old', () => {
      let spyOnMobileVersionServiceCheck;
      beforeEach(() => {
        spyOnMobileVersionServiceCheck = jest.spyOn(mobileVersionService, 'checkMobileVersion');
      });
      afterEach(() => {
        spyOnMobileVersionServiceCheck.mockReset();
      });

      it('should check mobile version', async () => {
        const version = generateMobileVersion();
        const platform = Platform.android;
        const build = generateMobileVersion();
        const CheckMobileVersionResponse = mockGenerateCheckMobileVersionResponse();
        spyOnMobileVersionServiceCheck.mockImplementationOnce(() => CheckMobileVersionResponse);
        const result = await controller.checkMobileVersionOld(version, platform, build);
        expect(spyOnMobileVersionServiceCheck).toBeCalledTimes(1);
        expect(spyOnMobileVersionServiceCheck).toBeCalledWith({ version, platform, build });
        expect(result).toEqual(CheckMobileVersionResponse);
      });
    });

    describe('check', () => {
      let spyOnMobileVersionServiceCheck;
      beforeEach(() => {
        spyOnMobileVersionServiceCheck = jest.spyOn(mobileVersionService, 'checkMobileVersion');
      });
      afterEach(() => {
        spyOnMobileVersionServiceCheck.mockReset();
      });

      it('should check mobile version', async () => {
        const checkMobileVersionParams = generateCheckMobileVersionParams();
        const CheckMobileVersionResponse = mockGenerateCheckMobileVersionResponse();
        spyOnMobileVersionServiceCheck.mockImplementationOnce(() => CheckMobileVersionResponse);
        const result = await controller.checkMobileVersion(checkMobileVersionParams);
        expect(spyOnMobileVersionServiceCheck).toBeCalledTimes(1);
        expect(spyOnMobileVersionServiceCheck).toBeCalledWith(checkMobileVersionParams);
        expect(result).toEqual(CheckMobileVersionResponse);
      });
    });
  });
});
