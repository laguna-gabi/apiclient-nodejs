import { Test, TestingModule } from '@nestjs/testing';
import { v4 } from 'uuid';
import { DbModule } from '../../src/db/db.module';
import {
  defaultDispatchParams,
  Dispatch,
  DispatchesModule,
  DispatchesService,
} from '../../src/dispatches';
import { generateDispatch } from '../generators';

describe(DispatchesService.name, () => {
  let module: TestingModule;
  let service: DispatchesService;

  beforeAll(async () => {
    module = await Test.createTestingModule({ imports: [DbModule, DispatchesModule] }).compile();

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
    { triggeredApi: null },
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
});
