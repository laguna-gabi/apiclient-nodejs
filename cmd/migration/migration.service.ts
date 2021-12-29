import * as path from 'path';
import * as fs from 'fs';
import * as Table from 'cli-table3';
import { find, values } from 'lodash';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Changelog, ChangelogDocument, Item } from '.';
import { Model } from 'mongoose';
import { migration } from 'config';

@Injectable()
export class MigrationService {
  constructor(
    @InjectModel(Changelog.name)
    private readonly changelogModel: Model<ChangelogDocument>,
  ) {}

  async getMigrationFiles() {
    const files = await fs.readdirSync(path.join(process.cwd(), migration.get('migrationDir')));

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

  async printStatusTable() {
    const table = new Table({
      head: ['Filename', 'Applied At'],
    });
    (await this.getStatusItems()).forEach((item) => table.push(values(item)));
    console.log(table.toString());
  }
}
