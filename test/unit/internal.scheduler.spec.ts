import { SchedulerRegistry } from '@nestjs/schedule';
import { Test, TestingModule } from '@nestjs/testing';
import { v4 } from 'uuid';
import { AppointmentModule, AppointmentScheduler } from '../../src/appointment';
import { InternalSchedulerService, LeaderType } from '../../src/scheduler';
import { dbConnect, dbDisconnect, defaultModules, generateId } from '../index';

describe('BaseScheduler + InternalSchedulerService', () => {
  let module: TestingModule;
  let scheduler: AppointmentScheduler;
  let internalSchedulerService: InternalSchedulerService;
  let schedulerRegistry: SchedulerRegistry;

  const leaderType = LeaderType.appointment;

  const clear = async () => {
    const timeouts = schedulerRegistry.getTimeouts();
    timeouts.map((timeout) => schedulerRegistry.deleteTimeout(timeout));

    await internalSchedulerService.resetLeader(leaderType);
  };

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: defaultModules().concat(AppointmentModule),
    }).compile();

    //Testing scheduler as if its AppointmentScheduler, we'll check the methods of BaseScheduler
    scheduler = module.get<AppointmentScheduler>(AppointmentScheduler);
    schedulerRegistry = module.get<SchedulerRegistry>(SchedulerRegistry);
    internalSchedulerService = module.get<InternalSchedulerService>(InternalSchedulerService);

    await dbConnect();
  });

  afterAll(async () => {
    await module.close();
    await dbDisconnect();
  });

  describe('runEveryMinute', () => {
    const initSchedulerVariables = () => {
      scheduler.initCallbacks = () => undefined;
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      scheduler.amITheLeader = false;
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      scheduler.identifier = v4();
    };

    beforeEach(async () => {
      initSchedulerVariables();
      await internalSchedulerService.resetLeader(leaderType);
    });

    afterEach(async () => {
      await clear();
    });

    it('should call runEveryMinute with no params in db for a specific type', async () => {
      await scheduler.runEveryMinute();
    });

    it('should update that i am the leader if i am the leader', async () => {
      const before1 = await internalSchedulerService.getLeader(leaderType);
      await scheduler.runEveryMinute();
      const before2 = await internalSchedulerService.getLeader(leaderType);
      await scheduler.runEveryMinute();
      const after2 = await internalSchedulerService.getLeader(leaderType);

      expect(before1).toBeNull();
      expect(before2.updatedAt).not.toEqual(after2.updatedAt); //runEveryMinute updates
    });

    it('should not update for the 2nd service when it is not the leader', async () => {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      const saveId = scheduler.identifier;
      await scheduler.runEveryMinute();

      //simulating access from another service - we've reset its identifier and amITheLeader fields
      initSchedulerVariables();
      await scheduler.runEveryMinute();

      const current = await internalSchedulerService.getLeader(leaderType);
      expect(current.id).toEqual(saveId);
    }, 12000);

    it('should delete an existing notification', async () => {
      const id = generateId();
      await schedulerRegistry.addTimeout(id, generateId());
      let timeouts = schedulerRegistry.getTimeouts();
      expect(timeouts[0]).toEqual(id);

      await scheduler.deleteTimeout({ id });
      timeouts = schedulerRegistry.getTimeouts();
      expect(timeouts.length).toEqual(0);
    });
  });
});
