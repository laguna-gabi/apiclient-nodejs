import { Injectable } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import * as Table from 'cli-table3';
import { migration } from 'config';
import { format } from 'date-fns';
import { appendFileSync, copyFileSync, readdirSync } from 'fs';
import { find, now, values } from 'lodash';
import { Connection, Model } from 'mongoose';
import { basename, extname, join } from 'path';
import { Changelog, ChangelogDocument, Command, InfoColoring, Item } from '.';
import * as migrationFiles from './scripts';

@Injectable()
export class MigrationService {
  constructor(
    @InjectModel(Changelog.name)
    private readonly changelogModel: Model<ChangelogDocument>,
    @InjectConnection() private connection: Connection,
  ) {}

  getMigrationRunner(pendingMigrationFileName: string) {
    const timestampMatch = pendingMigrationFileName.match('^(\\d+)');
    if (timestampMatch.length < 1) {
      throw new Error('invalid file name - missing timestamp unique prefix');
    }
    const fileKey = `m${timestampMatch[0]}`;
    if (migrationFiles[fileKey] === undefined) {
      throw new Error(`pending migration file ${pendingMigrationFileName} is not listed`);
    }

    return migrationFiles[fileKey];
  }

  async getMigrationFiles() {
    const files = readdirSync(join(process.cwd(), migration.get('migrationDir')));

    return files
      .filter(
        (file) =>
          extname(file) === migration.get('extension') &&
          basename(file) !== migration.get('sample') + migration.get('extension') &&
          basename(file) !== migration.get('index') + migration.get('extension'),
      )
      .sort();
  }

  async getStatusItems(): Promise<Item[]> {
    const migrationFiles = await this.getMigrationFiles();

    const changelogEntries = await this.changelogModel.find();

    const statusTable = migrationFiles.map((fileName) => {
      const itemInLog = find(changelogEntries, { fileName });
      const appliedAt = itemInLog ? itemInLog.appliedAt.toJSON() : 'PENDING';
      return { fileName, appliedAt };
    });

    return statusTable;
  }

  // Description: print out the migration status
  async status() {
    const table = new Table({
      head: ['Filename', 'Applied At'],
    });
    (await this.getStatusItems()).forEach((item) => table.push(values(item)));
    console.log(table.toString());
  }

  // Description: migrate `create` - generate a new migration file from sample
  create(description: string): string {
    const source = join(
      process.cwd(),
      migration.get('migrationDir'),
      migration.get('sample') + migration.get('extension'),
    );

    const timestamp = format(now(), 'yyyyMMddHHmmss');
    const suffix = description.split(' ').join('_');

    const filename = `${timestamp}-${suffix}${migration.get('extension')}`;
    const destination = join(process.cwd(), migration.get('migrationDir'), filename);
    copyFileSync(source, destination);

    // export new migration in index file:
    const index = join(process.cwd(), migration.get('migrationDir'), 'index.ts');
    appendFileSync(index, `export * as m${timestamp} from './${timestamp}-${suffix}';\n`);

    return filename;
  }

  // Description: migrate `up` - run all pending migration files (sorted by datetime)
  async up(dryRun?: boolean, fileName?: string): Promise<void> {
    if (fileName && extname(fileName) !== migration.get('extension')) {
      throw new Error('invalid file name - invalid extension');
    }
    const items = await this.getStatusItems();

    const pendingMigrations = fileName
      ? [fileName]
      : items
          .filter((item) => item.appliedAt === 'PENDING')
          .map((item) => item.fileName)
          .sort();

    if (!pendingMigrations.length) {
      console.info(InfoColoring, `'${Command.up}' says: nothing to do.. we're all set!`);
      return;
    }

    for (const pendingMigration of pendingMigrations) {
      let runner;

      try {
        runner = this.getMigrationRunner(pendingMigration);
      } catch (ex) {
        throw new Error(
          `failed to get a valid runner for migration file: ${pendingMigration}. got: ${ex}`,
        );
      }

      // running `up` callback method
      console.info(
        InfoColoring,
        `(${pendingMigration}) migrating ${Command.up} ${dryRun ? 'in dry run mode' : ''}`,
      );
      await runner.up(dryRun, this.connection.db);

      if (!dryRun) {
        await this.changelogModel.findOneAndUpdate(
          { fileName: pendingMigration },
          { $set: { appliedAt: new Date() } },
          { upsert: true },
        );
      }
    }
  }

  // Description: migrate `down` - undo latest migration invoked..
  async down(dryRun?: boolean, fileName?: string) {
    const items = await this.getStatusItems();

    const latestMigrationApplied =
      fileName ||
      items
        .filter((item) => item.appliedAt !== 'PENDING')
        .map((item) => item.fileName)
        .sort()
        .pop();

    if (!latestMigrationApplied) {
      console.info(
        InfoColoring,
        `'${Command.down}' says: nothing to do.. - changelog is dry.. run some migrations first!`,
      );
      return;
    }

    let runner;

    try {
      runner = this.getMigrationRunner(latestMigrationApplied);
    } catch (ex) {
      throw new Error(
        `failed to get a valid runner for migration file: ${latestMigrationApplied}. got: ${ex}`,
      );
    }

    // running `down` callback method
    console.info(
      InfoColoring,
      `(${latestMigrationApplied}) migrating ${Command.down} ${dryRun ? 'in dry run mode' : ''}`,
    );
    await runner.down(dryRun, this.connection.db);

    if (!dryRun) {
      await this.changelogModel.deleteOne({ fileName: latestMigrationApplied });
    }
  }
}
