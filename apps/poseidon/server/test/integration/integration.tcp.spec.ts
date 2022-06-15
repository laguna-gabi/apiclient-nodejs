import { mockLogger, mockProcessWarnings } from '@argus/pandora';
import {
  PoseidonMessagePatterns,
  Speaker,
  Transcript,
  TranscriptDocument,
  TranscriptDto,
} from '@argus/poseidonClient';
import { INestApplication } from '@nestjs/common';
import { ClientProxy, ClientsModule, MicroserviceOptions, Transport } from '@nestjs/microservices';
import { Test, TestingModule } from '@nestjs/testing';
import { datatype, lorem } from 'faker';
import { Model, model } from 'mongoose';
import { dbConnect, dbDisconnect, mockGenerateTranscriptDocument } from '..';
import { AppModule } from '../../src/app.module';
import { LoggerService } from '../../src/common';
import { StorageService } from '../../src/providers';

describe('Integration tcp', () => {
  let module: TestingModule;
  let app: INestApplication;
  let tcpClient: ClientProxy;
  let storageService: StorageService;
  let spyOnStorageServiceGetDownloadUrl;
  let transcriptModel: Model<TranscriptDocument>;

  beforeAll(async () => {
    mockProcessWarnings();
    const tcpPort = datatype.number({ min: 1000, max: 3000 });
    module = await Test.createTestingModule({
      imports: [
        AppModule,
        ClientsModule.register([
          { name: 'TCP_TEST_CLIENT', transport: Transport.TCP, options: { port: tcpPort } },
        ]),
      ],
    }).compile();
    app = module.createNestApplication();
    app.connectMicroservice<MicroserviceOptions>(
      {
        transport: Transport.TCP,
        options: {
          port: tcpPort,
        },
      },
      { inheritAppConfig: true },
    );
    app.useLogger(false);
    mockLogger(module.get<LoggerService>(LoggerService));

    await app.init();
    await dbConnect();

    tcpClient = module.get<ClientProxy>('TCP_TEST_CLIENT');
    storageService = module.get<StorageService>(StorageService);
    spyOnStorageServiceGetDownloadUrl = jest.spyOn(storageService, 'getDownloadUrl');
    transcriptModel = model<TranscriptDocument>(Transcript.name, TranscriptDto);

    await app.startAllMicroservices();
  });

  afterEach(async () => {
    spyOnStorageServiceGetDownloadUrl.mockReset();
  });

  afterAll(async () => {
    await app.close();
    await dbDisconnect();
  });

  it('should get transcript', async () => {
    const transcript = mockGenerateTranscriptDocument();
    await transcriptModel.create(transcript);

    const transcriptLink = `http://${lorem.word()}.com`;
    spyOnStorageServiceGetDownloadUrl.mockImplementationOnce(async () => transcriptLink);

    const result = await tcpClient
      .send<Transcript>(PoseidonMessagePatterns.getTranscript, {
        recordingId: transcript.recordingId,
      })
      .toPromise();

    expect(result).toEqual(
      expect.objectContaining({
        ...transcript,
        transcriptLink,
      }),
    );
  });

  it('should set speaker transcript', async () => {
    const transcript = mockGenerateTranscriptDocument({ coach: Speaker.speakerA });
    await transcriptModel.create(transcript);

    const transcriptLink = `http://${lorem.word()}.com`;
    spyOnStorageServiceGetDownloadUrl.mockImplementationOnce(async () => transcriptLink);

    const resultBefore = await tcpClient
      .send<Transcript>(PoseidonMessagePatterns.getTranscript, {
        recordingId: transcript.recordingId,
      })
      .toPromise();

    expect(resultBefore).toEqual(
      expect.objectContaining({
        ...transcript,
        coach: Speaker.speakerA,
        transcriptLink,
      }),
    );

    spyOnStorageServiceGetDownloadUrl.mockImplementationOnce(async () => transcriptLink);

    const resultAfter = await tcpClient
      .send<Transcript>(PoseidonMessagePatterns.setTranscriptSpeaker, {
        recordingId: transcript.recordingId,
        coach: Speaker.speakerB,
      })
      .toPromise();

    expect(resultAfter).toEqual(
      expect.objectContaining({
        ...transcript,
        coach: Speaker.speakerB,
        transcriptLink,
      }),
    );
  });
});
