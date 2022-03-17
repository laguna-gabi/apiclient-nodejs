import { mockLogger, mockProcessWarnings } from '@argus/pandora';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';
import { addHours, subMinutes } from 'date-fns';
import { v4 } from 'uuid';
import { CommonModule, LoggerService } from '../../src/common';
import {
  ConductorModule,
  Dispatch,
  DispatchInternalUpdate,
  DispatchStatus,
  DispatchesService,
  defaultDispatchParams,
} from '../../src/conductor';
import { DbModule } from '../../src/db';
import { generateDispatch, generateId } from '../generators';

describe(DispatchesService.name, () => {
  let module: TestingModule;
  let service: DispatchesService;

  beforeAll(async () => {
    mockProcessWarnings(); // to hide pino prettyPrint warning
    module = await Test.createTestingModule({
      imports: [DbModule, ConductorModule, CommonModule, EventEmitterModule.forRoot()],
    }).compile();

    service = module.get<DispatchesService>(DispatchesService);
    mockLogger(module.get<LoggerService>(LoggerService));
  });

  afterAll(async () => {
    await module.close();
  });

  it('should return undefined for a non existing dispatch', async () => {
    const dispatch = await service.get(v4());
    expect(dispatch).toBeNull();
  });

  it('should update and get a new dispatch', async () => {
    const dispatch: Dispatch = generateDispatch();
    const result = await service.update(dispatch);
    expect(result).toEqual(expect.objectContaining(dispatch));

    const resultGet = await service.get(dispatch.dispatchId);
    expect(resultGet).toEqual(expect.objectContaining(dispatch));
  });

  it('should update an existing dispatch', async () => {
    const dispatch: Dispatch = generateDispatch();
    const result = await service.update(dispatch);
    expect(result).toEqual(expect.objectContaining(dispatch));

    const newDispatch: Dispatch = generateDispatch({ dispatchId: dispatch.dispatchId });
    const resultNew = await service.update(newDispatch);
    expect(resultNew).toEqual(expect.objectContaining(newDispatch));
  });

  test.each([{ status: null }, { retryCount: null }])(
    'should override %p with default values',
    async (field) => {
      const key = Object.keys(field)[0];

      const dispatch = { ...generateDispatch(), ...field };
      expect(dispatch[key]).toEqual(null);

      const result = await service.update(dispatch);
      result[key] = defaultDispatchParams[key];
    },
  );

  it('should set default params to dispatch', async () => {
    const dispatch: Dispatch = generateDispatch();
    const result = await service.update(dispatch);
    expect(result).toEqual(expect.objectContaining(dispatch));

    const newDispatch: Dispatch = generateDispatch({ dispatchId: dispatch.dispatchId });
    const resultNew = await service.update(newDispatch);
    expect(resultNew).toEqual(expect.objectContaining(newDispatch));
  });

  test.each([
    { correlationId: null },
    { serviceName: null },
    { notificationType: null },
    { status: null },
    { retryCount: null },
  ])('should not override %p since it is not define in input', async (field) => {
    const key = Object.keys(field)[0];

    const dispatch: Dispatch = generateDispatch();
    const result = await service.update(dispatch);
    expect(result).toEqual(expect.objectContaining(dispatch));

    let newDispatch = generateDispatch({ dispatchId: dispatch.dispatchId });
    newDispatch = { ...newDispatch, ...field };
    expect(newDispatch[key]).toBeNull();

    const resultNew = await service.update(newDispatch);
    const expected = { ...newDispatch };
    expected[key] = result[key];

    expect(resultNew).toEqual(expect.objectContaining(expected));
  });

  it('should return null when trying to update a non existing dispatch', async () => {
    const result = await service.internalUpdate({
      dispatchId: generateId(),
      status: DispatchStatus.done,
    });
    expect(result).toBeNull();
  });

  it('should update, get and update a dispatch status to cancel', async () => {
    const data = generateDispatch();
    const dispatch = await service.update(data);

    let getResult = await service.get(dispatch.dispatchId);
    expect(getResult).toEqual(dispatch);

    const result = await service.internalUpdate({
      dispatchId: dispatch.dispatchId,
      status: DispatchStatus.canceled,
    });
    expect(result).toEqual(expect.objectContaining({ ...data, status: DispatchStatus.canceled }));

    getResult = await service.get(dispatch.dispatchId);
    expect(getResult).toEqual(
      expect.objectContaining({ ...data, status: DispatchStatus.canceled }),
    );
  });

  it('should not update null input params', async () => {
    const data = generateDispatch();
    const dispatch = await service.update(data);

    const result = await service.internalUpdate({
      dispatchId: dispatch.dispatchId,
      status: null,
      triggersAt: null,
    });
    expect(result).toEqual(expect.objectContaining(data));

    const getResult = await service.get(dispatch.dispatchId);
    expect(getResult).toEqual(expect.objectContaining(data));
  });

  it('should be able to internalUpdate existing dispatch', async () => {
    const data = generateDispatch();
    const dispatch = await service.update(data);

    const updateData: DispatchInternalUpdate = {
      dispatchId: data.dispatchId,
      appointmentId: generateId(),
      status: DispatchStatus.done,
    };
    const result = await service.internalUpdate(updateData);
    expect(result).toEqual(expect.objectContaining(updateData));

    const getResult = await service.get(dispatch.dispatchId);
    expect(getResult).toEqual(result);
  });

  it('should return null on trying to internalUpdate a non existing dispatch', async () => {
    const result = await service.internalUpdate({ dispatchId: generateId() });
    expect(result).toBeNull();
  });

  it(
    `should not update dispatch status to ${DispatchStatus.canceled} ` +
      `if current status != ${DispatchStatus.received}`,
    async () => {
      const data = generateDispatch({ status: DispatchStatus.done });
      const dispatch = await service.update(data);

      const updateResult = await service.internalUpdate({
        dispatchId: dispatch.dispatchId,
        status: DispatchStatus.canceled,
      });
      expect(updateResult).toBeNull();

      const result = await service.get(dispatch.dispatchId);
      expect(result).toEqual(expect.objectContaining(data));
    },
  );

  it(
    `should update dispatch status to ${DispatchStatus.canceled} ` +
      `if current status != ${DispatchStatus.received}`,
    async () => {
      const data = generateDispatch({ status: DispatchStatus.received });
      const dispatch = await service.update(data);

      const result = await service.internalUpdate({
        dispatchId: dispatch.dispatchId,
        status: DispatchStatus.canceled,
      });
      expect(result).toEqual(expect.objectContaining({ ...data, status: DispatchStatus.canceled }));
    },
  );

  it('should be able to find based on filter: dispatchId', async () => {
    const data = generateDispatch();
    const dispatch = await service.update({ ...data, triggeredId: generateId() });
    const result = await service.findOne({ triggeredId: dispatch.triggeredId });
    expect(result).toEqual(dispatch);
  });

  describe('find', () => {
    const senderClientId = generateId();
    const dispatchData1 = generateDispatch({ senderClientId });
    let dispatch1;
    const dispatchData2 = generateDispatch({ senderClientId });
    let dispatch2;

    beforeAll(async () => {
      // Fixtures (2 dispatch objects from the same sender):
      dispatch1 = await service.update(dispatchData1);
      dispatch2 = await service.update(dispatchData2);
    });

    it('should be able to find based on senderClientId with projection', async () => {
      const results = await service.find({ senderClientId }, [
        'dispatchId',
        'serviceName',
        'senderClientId',
      ]);

      expect(results).toEqual([
        {
          dispatchId: dispatch1.dispatchId,
          serviceName: dispatch1.serviceName,
          senderClientId: dispatch1.senderClientId,
        },
        {
          dispatchId: dispatch2.dispatchId,
          serviceName: dispatch2.serviceName,
          senderClientId: dispatch2.senderClientId,
        },
      ]);
    });

    it('should find an empty list for a user without dispatches', async () => {
      const results = await service.find({ senderClientId: generateId() }, [
        'dispatchId',
        'serviceName',
        'senderClientId',
      ]);

      expect(results).toEqual([]);
    });

    it('should be able to find based on senderClientId without projection', async () => {
      const results = await service.find({ senderClientId }, []);

      results.forEach((result) => {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        delete result.createdAt;
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        delete result.updatedAt;
      });
      expect(results).toEqual([dispatch1, dispatch2]);
    });
  });

  it('should be able to delete existing dispatches of specific client', async () => {
    const client1 = generateId();
    const client2 = generateId();
    const data1a = generateDispatch({ recipientClientId: client1 });
    const data1b = generateDispatch({ recipientClientId: client1 });
    const data2 = generateDispatch({ recipientClientId: client2 });

    await service.update({ ...data1a, triggeredId: generateId() });
    await service.update({ ...data1b, triggeredId: generateId() });
    await service.update({ ...data2, triggeredId: generateId() });

    await service.delete(client1);

    let result = await service.get(data1a.dispatchId);
    expect(result).toBeNull();
    result = await service.get(data1b.dispatchId);
    expect(result).toBeNull();
    result = await service.get(data2.dispatchId);
    expect(result).not.toBeNull();
  });

  it('should be able to call delete dispatch, even if client does not exist', async () => {
    const result = await service.delete(generateId());
    expect(result).toHaveLength(0);
  });

  describe('bulkUpdateFutureDispatches', () => {
    it(`should update all future dispatches having status=${DispatchStatus.received}`, async () => {
      const recipientClientId = v4();
      const senderClientId = v4();
      const data1 = generateDispatch({
        status: DispatchStatus.received,
        recipientClientId,
        senderClientId,
        triggersAt: addHours(new Date(), 1),
      });
      const dispatch1 = await service.update(data1);

      const data2 = generateDispatch({
        status: DispatchStatus.received,
        recipientClientId,
        senderClientId,
        triggersAt: subMinutes(new Date(), 1),
      });
      const dispatch2 = await service.update(data2);

      const data3 = generateDispatch({
        status: DispatchStatus.acquired,
        recipientClientId,
        senderClientId,
        triggersAt: subMinutes(new Date(), 1),
      });
      const dispatch3 = await service.update(data3);

      const data4 = generateDispatch({
        status: DispatchStatus.received,
        recipientClientId: generateId(), //checking that other recipients aren't changing
        senderClientId,
        triggersAt: addHours(new Date(), 1),
      });
      const dispatch4 = await service.update(data4);

      const newSenderClientId = generateId();
      await service.bulkUpdateFutureDispatches({
        recipientClientId,
        senderClientId: newSenderClientId,
      });

      const result1 = await service.get(dispatch1.dispatchId);
      expect(result1.senderClientId).toEqual(newSenderClientId);
      const result2 = await service.get(dispatch2.dispatchId);
      expect(result2.senderClientId).toEqual(senderClientId);
      const result3 = await service.get(dispatch3.dispatchId);
      expect(result3.senderClientId).toEqual(senderClientId);
      const result4 = await service.get(dispatch4.dispatchId);
      expect(result4.senderClientId).toEqual(senderClientId);
    });

    it(`should not update since status!=${DispatchStatus.received}`, async () => {
      const data = generateDispatch({
        status: DispatchStatus.error,
        triggersAt: subMinutes(new Date(), 1),
      });
      const dispatch = await service.update(data);

      await service.bulkUpdateFutureDispatches({
        recipientClientId: data.recipientClientId,
        senderClientId: generateId(),
      });

      const result = await service.get(dispatch.dispatchId);
      expect(result.senderClientId).toEqual(dispatch.senderClientId);
    });

    it('should not update since there is no sender to begin with', async () => {
      const data = generateDispatch({
        status: DispatchStatus.received,
        triggersAt: addHours(new Date(), 1),
      });
      data.senderClientId = undefined;
      const dispatch = await service.update(data);

      await service.bulkUpdateFutureDispatches({
        recipientClientId: data.recipientClientId,
        senderClientId: generateId(),
      });

      const result = await service.get(dispatch.dispatchId);
      expect(result.senderClientId).toEqual(undefined);
    });

    it('should not update anything in case there are no future dispatches', async () => {
      const data = generateDispatch({
        status: DispatchStatus.received,
        triggersAt: subMinutes(new Date(), 1),
      });
      const dispatch = await service.update(data);

      await service.bulkUpdateFutureDispatches({
        recipientClientId: data.recipientClientId,
        senderClientId: generateId(),
      });

      const result = await service.get(dispatch.dispatchId);
      expect(result.senderClientId).toEqual(dispatch.senderClientId);
    });

    it('should not update a record without triggersAt field', async () => {
      const data = generateDispatch({ status: DispatchStatus.received });
      delete data.triggersAt;

      const dispatch = await service.update(data);

      await service.bulkUpdateFutureDispatches({
        recipientClientId: data.recipientClientId,
        senderClientId: generateId(),
      });

      const result = await service.get(dispatch.dispatchId);
      expect(result.senderClientId).toEqual(dispatch.senderClientId);
    });
  });
});
