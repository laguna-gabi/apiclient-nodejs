import { mockLogger, mockProcessWarnings } from '@argus/pandora';
import { INestApplication } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { MongooseModule } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { disconnect } from 'mongoose';
import * as request from 'supertest';
import { generateDispatch, generateId } from '../.';
import { LoggerService } from '../../src/common';
import {
  Dispatch,
  DispatchDto,
  DispatchStatus,
  DispatchesController,
  DispatchesService,
} from '../../src/conductor';
import { DbModule } from '../../src/db';
import { ProvidersModule } from '../../src/providers';
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
