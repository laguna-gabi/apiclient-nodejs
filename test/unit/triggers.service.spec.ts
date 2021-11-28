import { Test, TestingModule } from '@nestjs/testing';
import { v4 } from 'uuid';
import { generateTriggers } from '../';
import { DbModule } from '../../src/db';
import { ConductorModule, Trigger, TriggersService } from '../../src/conductor';

describe(TriggersService.name, () => {
  let module: TestingModule;
  let service: TriggersService;

  beforeAll(async () => {
    module = await Test.createTestingModule({ imports: [DbModule, ConductorModule] }).compile();

    service = module.get<TriggersService>(TriggersService);
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
});
