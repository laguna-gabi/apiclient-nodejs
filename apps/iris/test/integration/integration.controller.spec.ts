import * as request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import {
  Dispatch,
  DispatchDto,
  DispatchStatus,
  DispatchesController,
  DispatchesService,
} from '../../src/conductor';
import { generateDispatch, generateId } from '../.';
import { disconnect } from 'mongoose';
import { mockLogger, mockProcessWarnings } from '@argus/pandora';
import { LoggerService } from '../../src/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ProvidersModule } from '../../src/providers';
import { DbModule } from '../../src/db';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { SettingsModule } from '../../src/settings';

describe('Controllers', () => {
  let app: INestApplication;
  let dispatchesService: DispatchesService;
  let module: TestingModule;

  beforeAll(async () => {
    mockProcessWarnings();
    module = await Test.createTestingModule({
      imports: [
        EventEmitterModule.forRoot(),
        DbModule,
        ProvidersModule,
        SettingsModule,
        MongooseModule.forFeature([{ name: Dispatch.name, schema: DispatchDto }]),
      ],
      providers: [DispatchesService],
      controllers: [DispatchesController],
    }).compile();

    dispatchesService = module.get<DispatchesService>(DispatchesService);
    mockLogger(module.get<LoggerService>(LoggerService));

    app = module.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await disconnect();
    await app.close();
  });

  describe(DispatchesController.name, () => {
    it(`/GET getBySenderClientId`, async () => {
      const senderClientId = generateId();

      const dispatchDone = await dispatchesService.update(
        generateDispatch({ senderClientId, status: DispatchStatus.done }),
      );

      // generate another (acquired) dispatch - should not be included in response
      await dispatchesService.update(
        generateDispatch({ senderClientId, status: DispatchStatus.acquired }),
      );

      await request(app.getHttpServer())
        .get(`/dispatches/${senderClientId}/?projection=status,senderClientId,contentKey`)
        .expect(200)
        .expect([
          {
            status: dispatchDone.status,
            senderClientId: dispatchDone.senderClientId,
            contentKey: dispatchDone.contentKey,
          },
        ]);
    }, 10000);
  });
});
