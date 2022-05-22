import { generateId, mockLogger, mockProcessWarnings } from '@argus/pandora';
import { HttpService } from '@nestjs/axios';
import { Test, TestingModule } from '@nestjs/testing';
import { dbDisconnect, defaultModules, mockGenerateDispatch } from '..';
import { LoggerService } from '../../src/common';
import { NotificationService, ServiceModule } from '../../src/services';
import { services } from 'config';

describe('NotificationService', () => {
  let module: TestingModule;
  let httpService: HttpService;
  let service: NotificationService;

  beforeAll(async () => {
    mockProcessWarnings(); // to hide pino prettyPrint warning
    module = await Test.createTestingModule({
      imports: defaultModules().concat(ServiceModule),
    }).compile();

    httpService = module.get<HttpService>(HttpService);
    service = module.get<NotificationService>(NotificationService);
    mockLogger(module.get<LoggerService>(LoggerService));
    await service.onModuleInit();
  });

  afterAll(async () => {
    await module.close();
    await dbDisconnect();
  });

  describe('getDispatchesByClientSenderId', () => {
    let spyOnHttpServiceGet: jest.SpyInstance;
    let spyOnServiceOnModuleInit: jest.SpyInstance;

    beforeEach(() => {
      spyOnHttpServiceGet = jest.spyOn(httpService, 'get');
      spyOnServiceOnModuleInit = jest.spyOn(service, 'onModuleInit');
    });

    afterEach(() => {
      spyOnHttpServiceGet.mockReset();
      spyOnServiceOnModuleInit.mockReset();
    });

    it('should successfully send a request', async () => {
      const senderClientId = generateId();
      const dispatch = mockGenerateDispatch();
      spyOnHttpServiceGet.mockReturnValue({
        toPromise: () => {
          return { status: 200, data: [dispatch] };
        },
      });
      const result = await service.getDispatchesByClientSenderId(senderClientId, [
        'field1',
        'field2',
      ]);
      expect(spyOnHttpServiceGet).toBeCalledTimes(1);
      expect(spyOnHttpServiceGet).toBeCalledWith(
        `http://localhost:${services.iris.port}/dispatches/${senderClientId}`,
        {
          params: { projection: 'field1,field2', status: 'done' },
          timeout: 2000,
        },
      );
      expect(result).toEqual([dispatch]);
    });

    it('should fail on request', async () => {
      const senderClientId = generateId();
      spyOnHttpServiceGet.mockReturnValue({
        toPromise: () => {
          return { status: 500 };
        },
      });
      await expect(
        service.getDispatchesByClientSenderId(senderClientId, ['field1', 'field2']),
      ).rejects.toThrow();

      expect(spyOnHttpServiceGet).toBeCalledTimes(1);
      expect(spyOnHttpServiceGet).toBeCalledWith(
        `http://localhost:${services.iris.port}/dispatches/${senderClientId}`,
        {
          params: { projection: 'field1,field2', status: 'done' },
          timeout: 2000,
        },
      );
    });

    test.each(['ECONNREFUSED', 'ECONNABORTED', 'ENOTFOUND', 'ECONNRESET'])(
      'should fail after 4 retries due to %p error code',
      async (code) => {
        const senderClientId = generateId();

        spyOnHttpServiceGet.mockImplementation(() => {
          throw { code };
        });

        try {
          await service.getDispatchesByClientSenderId(senderClientId, ['field1', 'field2']);
        } catch (ex) {
          expect(ex).toEqual({ code });
        }

        expect(spyOnHttpServiceGet).toBeCalledTimes(4);
        expect(spyOnHttpServiceGet).toBeCalledWith(
          `http://localhost:${services.iris.port}/dispatches/${senderClientId}`,
          {
            params: { projection: 'field1,field2', status: 'done' },
            timeout: 2000,
          },
        );
      },
    );
  });
});
