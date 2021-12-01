import { Test, TestingModule } from '@nestjs/testing';
import { v4 } from 'uuid';
import { CommonModule } from '../../src/common';
import { DbModule } from '../../src/db';
import {
  ConductorModule,
  Dispatch,
  DispatchInternalUpdate,
  DispatchStatus,
  DispatchesService,
  defaultDispatchParams,
} from '../../src/conductor';
import { generateDispatch, generateId } from '../generators';

describe(DispatchesService.name, () => {
  let module: TestingModule;
  let service: DispatchesService;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [DbModule, ConductorModule, CommonModule],
    }).compile();

    service = module.get<DispatchesService>(DispatchesService);
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
    { sourceApi: null },
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
      triggeredAt: null,
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
});
