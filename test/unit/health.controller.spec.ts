import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';
import { Logger } from '../../src/common';
import { HealthController } from '../../src/health/health.controller';
import { mockLogger } from '../index';

describe('HealthController', () => {
  let controller: HealthController;
  let module: TestingModule;
  let app: INestApplication;

  beforeAll(async () => {
    module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication();

    controller = module.get<HealthController>(HealthController);
    mockLogger(module.get<Logger>(Logger));
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
