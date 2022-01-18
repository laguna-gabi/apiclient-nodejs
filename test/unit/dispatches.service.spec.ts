import { mockLogger, mockProcessWarnings } from '@lagunahealth/pandora';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';
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

  describe.only('find', () => {
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
});
