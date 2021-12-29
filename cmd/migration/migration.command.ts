import { Command, CommandRunner } from 'nest-commander';
import { MigrationService } from '.';

@Command({
  name: 'migration',
  description: 'migration orchestration command - find and execute pending migration scripts',
  arguments: '<command>',
  argsDescription: { command: 'migration orchestration command to run: [`up`,`down`, `status`]' },
})
export class MigrationCommand implements CommandRunner {
  constructor(private readonly migrationService: MigrationService) {}
  async run(passedParam: string[]): Promise<void> {
    try {
      switch (passedParam[0]) {
        case 'create': {
          console.log(`Migration: scaffolding...`);
          // TODO
          break;
        }
        case 'up': {
          console.log(`Migration: going up...`);
          // TODO
          break;
        }
        case 'down': {
          console.log(`Migration: going down...`);
          // TODO
          break;
        }
        case 'status': {
          await this.migrationService.printStatusTable();
          break;
        }
        default: {
          console.log(`Migration: command [${passedParam[0]}] not supported`);
        }
      }
    } catch (err) {
      console.error(`Migration Command: error: got: ${err.message} (${err.stack})`);
    }
  }
}
