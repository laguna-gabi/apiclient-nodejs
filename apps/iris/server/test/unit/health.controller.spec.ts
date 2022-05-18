import { mockLogger, mockProcessWarnings } from '@argus/pandora';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';
import { LoggerService } from '../../src/common';
import { HealthController } from '../../src/health/health.controller';

describe('HealthController', () => {
  let controller: HealthController;
  let module: TestingModule;
  let app: INestApplication;

  beforeAll(async () => {
    mockProcessWarnings(); // to hide pino prettyPrint warning
    module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication();

    controller = module.get<HealthController>(HealthController);
    mockLogger(module.get<LoggerService>(LoggerService));
  });

  afterAll(async () => {
    await app.close();
  });

  it('health should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should return false when queue notifications are not set', async () => {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    controller.mongoose.pingCheck = jest.fn().mockReturnValueOnce(true);
    const check = await controller.check();
    const statusDown = { status: 'down' };
    const queueResult = {
      auditQueueUrl: statusDown,
      notificationsQueueUrl: statusDown,
      notificationsDLQUrl: statusDown,
    };
    expect(check).toEqual({ status: 'ok', info: queueResult, error: {}, details: queueResult });
  });
});
