import * as path from 'path';
import * as fs from 'fs';
import * as Table from 'cli-table3';
import { find, now, values } from 'lodash';
import { Injectable } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Changelog, ChangelogDocument, Command, InfoColoring, Item } from '.';
import { Connection, Model } from 'mongoose';
import { migration } from 'config';
import { format } from 'date-fns';

@Injectable()
export class MigrationService {
  constructor(
    @InjectModel(Changelog.name)
    private readonly changelogModel: Model<ChangelogDocument>,
    @InjectConnection() private connection: Connection,
  ) {}

  async getMigrationFiles() {
    const files = fs.readdirSync(path.join(process.cwd(), migration.get('migrationDir')));

    return files
      .filter(
        (file) =>
          path.extname(file) === migration.get('extension') &&
          path.basename(file) !== migration.get('sample') + migration.get('extension'),
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
    const source = path.join(
      process.cwd(),
      migration.get('migrationDir'),
      migration.get('sample') + migration.get('extension'),
    );
    const filename = `${format(now(), 'yyyyMMddHHmmss')}-${description
      .split(' ')
      .join('_')}${migration.get('extension')}`;
    const destination = path.join(process.cwd(), migration.get('migrationDir'), filename);
    fs.copyFileSync(source, destination);
    return filename;
  }

  // Description: migrate `up` - run all pending migration files (sorted by datetime)
  async up(dryRun?: boolean, fileName?: string): Promise<void> {
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
      const { up } = await import(
        path.join(process.cwd(), migration.get('migrationDir'), pendingMigration)
      );

      await up(dryRun, this.connection);

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

    const { down } = await import(
      path.join(process.cwd(), migration.get('migrationDir'), latestMigrationApplied)
    );

    await down(dryRun, this.connection).catch((e: Error) => {
      throw e;
    });

    if (!dryRun) {
      await this.changelogModel.deleteOne({ fileName: latestMigrationApplied });
    }
  }
}
