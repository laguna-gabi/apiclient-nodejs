import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';
import { HealthController } from '../../src/health.controller';

describe('HealthController', () => {
  let controller: HealthController;
  let module: TestingModule;
  let app: INestApplication;

  beforeAll(async () => {
    module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication();

    controller = module.get<HealthController>(HealthController);
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
    const queueOk = { notificationsDLQ: { status: 'down' }, notificationsQ: { status: 'down' } };
    expect(check).toEqual({
      status: 'ok',
      info: queueOk,
      error: {},
      details: queueOk,
    });
  });
});
