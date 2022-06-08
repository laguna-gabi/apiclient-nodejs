import { Caregiver } from '@argus/hepiusClient';
import {
  ChangeEventType,
  EntityName,
  createChangeEvent,
  generateId,
  mockLogger,
  mockProcessWarnings,
} from '@argus/pandora';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';
import { pickBy } from 'lodash';
import { Model, Types, model } from 'mongoose';
import {
  dbConnect,
  dbDisconnect,
  defaultModules,
  generateAddCaregiverParams,
  generateUpdateCaregiverParams,
  loadSessionClient,
} from '..';
import { LoggerService } from '../../src/common';
import { Audit } from '../../src/db';
import {
  CaregiverDocument,
  CaregiverDto,
  CaregiverService,
  JourneyModule,
} from '../../src/journey';
import { confirmEmittedChangeEvent } from '../common';

describe(CaregiverService.name, () => {
  let module: TestingModule;
  let service: CaregiverService;
  let modelCaregiver: Model<CaregiverDocument>;

  beforeAll(async () => {
    mockProcessWarnings(); // to hide pino prettyPrint warning
    module = await Test.createTestingModule({
      imports: defaultModules().concat(JourneyModule),
    }).compile();

    service = module.get<CaregiverService>(CaregiverService);
    modelCaregiver = model<CaregiverDocument>(Caregiver.name, CaregiverDto);

    mockLogger(module.get<LoggerService>(LoggerService));

    await dbConnect();
  });

  afterAll(async () => {
    await module.close();
    await dbDisconnect();
  });

  let caregiverId;
  let mockEventEmitterEmit: jest.SpyInstance;

  beforeAll(() => {
    mockEventEmitterEmit = jest.spyOn(module.get<EventEmitter2>(EventEmitter2), `emit`);
  });

  afterEach(() => {
    mockEventEmitterEmit.mockReset();
  });

  it('should add a caregiver', async () => {
    const memberId = generateId();

    // start a session and set member id as client in store
    loadSessionClient(memberId);

    const caregiverParams = generateAddCaregiverParams({ memberId });
    const { id } = await service.addCaregiver(caregiverParams);

    caregiverId = id;

    confirmEmittedChangeEvent(
      mockEventEmitterEmit,
      createChangeEvent({
        action: ChangeEventType.updated,
        entity: EntityName.caregiver,
        memberId,
      }),
    );

    const caregiver = await service.getCaregiver(id);

    expect(caregiver).toEqual(
      expect.objectContaining({
        ...pickBy(
          caregiverParams,
          (value, key) => ['memberId', 'id', 'createdBy'].indexOf(key) >= 0,
        ),
        memberId: new Types.ObjectId(memberId),
        createdBy: new Types.ObjectId(memberId),
        updatedBy: new Types.ObjectId(memberId),
        _id: new Types.ObjectId(id),
      }),
    );
  });

  it('should update a caregiver', async () => {
    const memberId = generateId();
    const journeyId = generateId();
    const updateCaregiverParams = generateUpdateCaregiverParams({
      id: caregiverId,
      memberId,
    });

    // start a session and set member id as client in store
    loadSessionClient(memberId);

    const { id, createdBy } = (await service.updateCaregiver({
      ...updateCaregiverParams,
      journeyId,
    })) as Caregiver & Audit;

    confirmEmittedChangeEvent(
      mockEventEmitterEmit,
      createChangeEvent({
        action: ChangeEventType.updated,
        entity: EntityName.caregiver,
        memberId,
      }),
    );

    const caregiver = await service.getCaregiver(id);
    expect(caregiver).toEqual(
      expect.objectContaining({
        ...pickBy(updateCaregiverParams, (value, key) => key !== 'id' && key !== 'memberId'),
        memberId: new Types.ObjectId(memberId),
        journeyId: new Types.ObjectId(journeyId),
        updatedBy: new Types.ObjectId(memberId),
        createdBy,
        _id: new Types.ObjectId(id),
      }),
    );
  });

  it('should (hard) delete a soft deleted caregiver', async () => {
    const memberId = generateId();
    const caregiverParams = generateAddCaregiverParams({ memberId });
    const { id } = await service.addCaregiver(caregiverParams);

    await service.deleteCaregiver(id, memberId.toString());
    await service.deleteCaregiver(id, memberId.toString(), true);

    confirmEmittedChangeEvent(
      mockEventEmitterEmit,
      createChangeEvent({
        action: ChangeEventType.deleted,
        entity: EntityName.caregiver,
        memberId,
      }),
    );

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const deletedCaregiver = await modelCaregiver.findOneWithDeleted({
      _id: new Types.ObjectId(id),
    });

    expect(deletedCaregiver).toBeFalsy();
  });

  it('should get a caregiver by member id', async () => {
    const memberId = generateId();
    const journeyId = generateId();
    const updateCaregiverParams = generateUpdateCaregiverParams({
      id: caregiverId,
      memberId,
    });

    const caregiver = await service.updateCaregiver({ ...updateCaregiverParams, journeyId });

    expect(await service.getCaregivers({ memberId, journeyId })).toEqual([caregiver]);
  });
});
