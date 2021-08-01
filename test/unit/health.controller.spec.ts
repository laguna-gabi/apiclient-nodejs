import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from '../../src/health/health.controller';
import { AppModule } from '../../src/app.module';
import { INestApplication } from '@nestjs/common';

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

  it('health should have status ok', async () => {
    const check = await controller.check();
    const mongooseOk = { mongoose: { status: 'up' } };
    expect(check).toEqual({
      status: 'ok',
      info: mongooseOk,
      error: {},
      details: mongooseOk,
    });
  });
});
