import { Command } from 'commander';
import * as path from 'path';
// ------------------------------------------------------------------------------------------------
// Description: migrate `up`
// ------------------------------------------------------------------------------------------------
const up = async (options) => {
  console.log(`(${path.basename(__filename)}) migrating up`);
  if (options.dryRun) {
    console.log('dry run mode');
  }

  // migration (up) code here:
};

// ------------------------------------------------------------------------------------------------
// Description: migrate `down`
// ------------------------------------------------------------------------------------------------
const down = async (options) => {
  console.log(`(${path.basename(__filename)}) migrating down`);
  if (options.dryRun) {
    console.log('dry run mode');
  }

  // migration (down) code here:
};

// ------------------------------------------------------------------------------------------------
// DO NOT CHANGE BELOW THIS LINE
// ------------------------------------------------------------------------------------------------
const program = new Command();
program
  .command('up')
  .option('-d, --dry-run', 'dry run mode - will not apply changes to db')
  .description(`migrate up`)
  .action((options) => {
    up(options);
  });

program
  .command('down')
  .option('-d, --dry-run', 'dry run mode - will not apply changes to db')
  .description(`migrate down`)
  .action((options) => {
    down(options);
  });

program.parse(process.argv);
