/* eslint-disable max-len */
import { Command, CommandRunner, Option } from 'nest-commander';
import { ErrorColoring, InfoColoring, MigrationService } from '.';

interface MigrationCommandOptions {
  dryRun?: boolean;
}
@Command({
  name: 'migration',
  description: 'migration orchestration command - find and execute pending migration scripts',
  arguments: '<command>',
  argsDescription: {
    command:
      'migration orchestration command \n' +
      'create [name]                create a new database migration with the provided description\n' +
      'up [name] [-d --dry-run]     run all pending database migrations (optional field - name to "up" a specific migration)\n' +
      'down [name] [-d --dry-run]   undo the last applied database migration (optional field - name to "up" a specific migration)\n' +
      'status                       print the changelog of the database',
  },
})
export class MigrationCommand implements CommandRunner {
  constructor(private readonly migrationService: MigrationService) {}
  async run(passedParam: string[], options?: MigrationCommandOptions): Promise<void> {
    try {
      switch (passedParam[0]) {
        case 'create': {
          console.info(InfoColoring, `Migration: scaffolding...`);
          if (!passedParam[1]) {
            throw new Error('missing a migration name');
          }
          this.migrationService.create(passedParam[1]);
          break;
        }
        case 'up': {
          console.info(InfoColoring, `Migration: going up...`);
          await this.migrationService.up(options?.dryRun, passedParam[1]);
          break;
        }
        case 'down': {
          console.info(InfoColoring, `Migration: going down...`);
          await this.migrationService.down(options?.dryRun, passedParam[1]);
          break;
        }
        case 'status': {
          console.info(InfoColoring, `Migration: checking what's up...`);
          await this.migrationService.status();
          break;
        }
        default: {
          console.info(InfoColoring, `Migration: command [${passedParam[0]}] not supported`);
        }
      }
    } catch (err) {
      console.error(ErrorColoring, `Migration Command: error: got: ${err.message}`);
    }
  }

  /**************************************** Command Options  **************************************/

  @Option({
    flags: '-d, --dry-run',
    description: 'run in dry-run mode - passed on to all migrations',
    defaultValue: false,
  })
  parseDryRun(val: boolean): boolean {
    return val;
  }
}
