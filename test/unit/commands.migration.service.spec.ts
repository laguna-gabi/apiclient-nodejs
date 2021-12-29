import { dbDisconnect, defaultModules } from '../.';
import { Changelog, ChangelogDocument, MigrationModule, MigrationService } from '../../cmd';
import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { migration } from 'config';
import { readdirSync } from 'fs';
import * as faker from 'faker';
import { add } from 'date-fns';

jest.mock('fs', () => {
  const actualFS = jest.requireActual('fs');
  const mockReaddirSync = jest.fn(actualFS.readdirSync);
  return { ...actualFS, readdirSync: mockReaddirSync };
});

describe('Commands: MigrationService', () => {
  let module: TestingModule;
  let migrationService: MigrationService;
  let changelogModel: Model<Changelog>;
  let spyOnMockCatalogModel: jest.SpyInstance;
  const migrationFiles = new Map<string, string>();
  const startDate = faker.datatype.datetime();

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: defaultModules().concat(MigrationModule),
      providers: [
        {
          provide: getModelToken(Changelog.name),
          useValue: Model,
        },
        MigrationService,
      ],
    }).compile();

    migrationService = module.get<MigrationService>(MigrationService);
    changelogModel = module.get<Model<Changelog>>(getModelToken(Changelog.name));
    spyOnMockCatalogModel = jest.spyOn(changelogModel, 'find');

    // preparing a list of migration files for tests:
    migrationFiles.set(
      'migration_1',
      startDate.getTime() + faker.lorem.slug() + migration.get('extension'),
    );
    migrationFiles.set(
      'migration_2',
      add(startDate, { hours: 1 }).getTime() + faker.lorem.slug() + migration.get('extension'),
    );
    migrationFiles.set(
      'migration_3',
      add(startDate, { hours: 2 }).getTime() + faker.lorem.slug() + migration.get('extension'),
    );
    migrationFiles.set(
      'migration_4',
      add(startDate, { hours: 3 }).getTime() + faker.lorem.slug() + migration.get('extension'),
    );
    migrationFiles.set('sample', migration.get('sample') + migration.get('extension'));
    migrationFiles.set(
      'migration_5_js_ext',
      add(startDate, { hours: 4 }).getTime() + faker.lorem.slug() + '.js',
    );
  });

  afterAll(async () => {
    await module.close();
    await dbDisconnect();
  });

  describe('getMigrationFiles', () => {
    afterAll(async () => {
      await module.close();
      await dbDisconnect();
    });

    afterEach(() => {
      spyOnMockCatalogModel.mockReset();
      (readdirSync as jest.Mock).mockReset();
    });

    it('to return an empty list of files for an empty directory', async () => {
      (readdirSync as jest.Mock).mockImplementation(() => []);

      expect(await migrationService.getMigrationFiles()).toEqual([]);
    });

    it('to return an empty list of files if the only file is a sample file', async () => {
      (readdirSync as jest.Mock).mockImplementation(() => [migration.get('sample')]);

      expect(await migrationService.getMigrationFiles()).toEqual([]);
    });

    // eslint-disable-next-line max-len
    it('to return a non empty sorted list of migration files (filter out invalid ext and sample file)', async () => {
      (readdirSync as jest.Mock).mockImplementation(() => [
        migrationFiles.get('migration_2'),
        migrationFiles.get('sample'),
        migrationFiles.get('migration_1'),
        migrationFiles.get('migration_5_js_ext'),
      ]);

      expect(await migrationService.getMigrationFiles()).toEqual([
        migrationFiles.get('migration_1'),
        migrationFiles.get('migration_2'),
      ]);
    });
  });

  describe('getStatusItems', () => {
    afterEach(() => {
      spyOnMockCatalogModel.mockReset();
      (readdirSync as jest.Mock).mockReset();
    });

    it('to return list of items with correct status (applied date or `PENDING`', async () => {
      // files not in changelog are still PENDING (file4)
      const changeLogData: ChangelogDocument[] = [
        { fileName: migrationFiles.get('migration_1'), appliedAt: startDate } as ChangelogDocument,
        {
          fileName: migrationFiles.get('migration_2'),
          appliedAt: add(startDate, { days: 1 }),
        } as ChangelogDocument,
        {
          fileName: migrationFiles.get('migration_3'),
          appliedAt: add(startDate, { days: 2 }),
        } as ChangelogDocument,
      ];

      // not all files are in the migration directory: migration_3 is missing and should not appear in stats
      jest
        .spyOn(migrationService, 'getMigrationFiles')
        .mockResolvedValue([
          migrationFiles.get('migration_1'),
          migrationFiles.get('migration_2'),
          migrationFiles.get('migration_4'),
        ]);

      jest.spyOn(changelogModel, 'find').mockResolvedValue(changeLogData);

      expect(await migrationService.getStatusItems()).toEqual([
        { appliedAt: startDate.toJSON(), fileName: migrationFiles.get('migration_1') },
        {
          appliedAt: add(startDate, { days: 1 }).toJSON(),
          fileName: migrationFiles.get('migration_2'),
        },
        { appliedAt: 'PENDING', fileName: migrationFiles.get('migration_4') },
      ]);
    });
  });
});
