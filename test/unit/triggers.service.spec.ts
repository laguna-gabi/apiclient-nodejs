import { EventEmitterModule } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';
import { v4 } from 'uuid';
import { generateId, generateTriggers } from '../';
import { DbModule } from '../../src/db';
import { ConductorModule, Trigger, TriggersService } from '../../src/conductor';
import { LoggerService } from '../../src/common';
import { mockLogger } from '@lagunahealth/pandora';

describe(TriggersService.name, () => {
  let module: TestingModule;
  let service: TriggersService;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [DbModule, ConductorModule, EventEmitterModule.forRoot()],
    }).compile();

    service = module.get<TriggersService>(TriggersService);
    mockLogger(module.get<LoggerService>(LoggerService));
  });

  afterAll(async () => {
    await module.close();
  });

  it('should update a new trigger and get it', async () => {
    const trigger: Trigger = generateTriggers();
    const result = await service.update(trigger);
    expect(result).toEqual(expect.objectContaining(trigger));

    const triggerData = await service.get(trigger.dispatchId);
    expect(triggerData).toEqual(expect.objectContaining(trigger));
  });

  it('should update for an existing trigger', async () => {
    const trigger: Trigger = generateTriggers();
    const result = await service.update(trigger);
    expect(result).toEqual(expect.objectContaining(trigger));

    const newTrigger: Trigger = generateTriggers({ dispatchId: trigger.dispatchId });
    const resultNew = await service.update(newTrigger);
    expect(resultNew).toEqual(expect.objectContaining(newTrigger));
  });

  it('should return null for a non existing trigger', async () => {
    const triggerData = await service.get(v4());
    expect(triggerData).toBeNull();
  });

  it('should add to ignoreDeletes a delete from the api', async () => {
    const trigger: Trigger = generateTriggers();
    const { _id } = await service.update(trigger);
    await service.delete(trigger.dispatchId);

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    expect(service.ignoreDeletes.has(_id.toString())).toBeTruthy();
  });

  it('should not add to ignoreDeletes a trigger which does not exist', async () => {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const ignoreDeletesBefore = service.ignoreDeletes;
    const dispatchId = generateId();
    await service.delete(dispatchId);

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    expect(service.ignoreDeletes).toEqual(ignoreDeletesBefore);
  });
});
