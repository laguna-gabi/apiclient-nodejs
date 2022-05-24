import { mockLogger, mockProcessWarnings } from '@argus/pandora';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { QueueService } from '../../src/providers';
import { AppModule } from '../../src/app.module';
import { LoggerService } from '../../src/common';
import { HealthController } from '../../src/health';

describe('HealthController', () => {
  let controller: HealthController;
  let module: TestingModule;
  let app: INestApplication;
  let queueService: QueueService;

  beforeAll(async () => {
    mockProcessWarnings(); // to hide pino prettyPrint warning
    module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication();

    controller = module.get<HealthController>(HealthController);
    queueService = module.get<QueueService>(QueueService);
    mockLogger(module.get<LoggerService>(LoggerService));
  });

  afterAll(async () => {
    await app.close();
  });

  it('health should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should return false when change event queue is not set', async () => {
    const check = await controller.check();
    const queueResult = {
      changeEventQueueUrl: { status: 'down' },
    };
    expect(check).toEqual({ status: 'ok', info: queueResult, error: {}, details: queueResult });
  });

  it('should return true when change event queue is set', async () => {
    await queueService.onModuleInit();
    const check = await controller.check();
    const queueResult = {
      changeEventQueueUrl: { status: 'up' },
    };
    expect(check).toEqual({ status: 'ok', info: queueResult, error: {}, details: queueResult });
  });
});
