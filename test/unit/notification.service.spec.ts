import { mockLogger, mockProcessWarnings } from '@lagunahealth/pandora';
import { Test, TestingModule } from '@nestjs/testing';
import { LoggerService } from '../../src/common';
import { dbDisconnect, defaultModules, generateId, mockGenerateDispatch } from '../index';
import { NotificationService, ServiceModule } from '../../src/services';
import { HttpService } from '@nestjs/common';

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
    service.onModuleInit();
  });

  afterAll(async () => {
    await module.close();
    await dbDisconnect();
  });

  describe('getDispatchesByClientSenderId', () => {
    let spyOnHttpServiceGet: jest.SpyInstance;

    beforeEach(() => {
      spyOnHttpServiceGet = jest.spyOn(httpService, 'get');
    });

    afterEach(() => {
      spyOnHttpServiceGet.mockReset();
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
        `http://localhost:3001/dispatches/${senderClientId}`,
        {
          params: { projection: 'field1,field2', status: 'done' },
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
      expect(
        service.getDispatchesByClientSenderId(senderClientId, ['field1', 'field2']),
      ).rejects.toThrow();

      expect(spyOnHttpServiceGet).toBeCalledTimes(1);
      expect(spyOnHttpServiceGet).toBeCalledWith(
        `http://localhost:3001/dispatches/${senderClientId}`,
        {
          params: { projection: 'field1,field2', status: 'done' },
        },
      );
    });
  });
});
