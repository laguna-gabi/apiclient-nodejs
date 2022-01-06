import { dbDisconnect, defaultModules } from '../.';
import { Changelog, ChangelogDocument, MigrationModule, MigrationService } from '../../cmd';
import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { migration } from 'config';
import { readdirSync, unlinkSync } from 'fs';
import * as faker from 'faker';
import { add } from 'date-fns';
import * as path from 'path';
import { delay } from '../../src/common';
import { mockProcessWarnings } from '@lagunahealth/pandora';

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
    mockProcessWarnings(); // to hide pino prettyPrint warning
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

    jest.spyOn(console, 'info').mockImplementation(); // suppress log messages during test
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

  describe('test `up` and `down` and `create` commands', () => {
    const testMigrationDir = new Map<string, string>();
    // const spyOnMockCatalogModelFind;
    let spyFindOneAndUpdateOnMockCatalogModel: jest.SpyInstance;
    let spyDeleteOneOnMockCatalogModel: jest.SpyInstance;
    beforeAll(async () => {
      testMigrationDir.set('migration_1', migrationService.create(faker.system.fileName()));
      await delay(1000); // make sure files are not created with the same timestamp - sort should work
      testMigrationDir.set('migration_2', migrationService.create(faker.system.fileName()));

      spyFindOneAndUpdateOnMockCatalogModel = jest.spyOn(changelogModel, 'findOneAndUpdate');
      spyDeleteOneOnMockCatalogModel = jest.spyOn(changelogModel, 'deleteOne');
    });

    afterEach(() => {
      spyFindOneAndUpdateOnMockCatalogModel.mockReset();
      spyDeleteOneOnMockCatalogModel.mockReset();
    });

    afterAll(async () => {
      // Delete our test migration files
      testMigrationDir.forEach((file) => {
        unlinkSync(path.join(process.cwd(), migration.get('migrationDir'), file));
      });
    });

    describe('`up` command', () => {
      it('should do nothing if no pending migrations', async () => {
        jest.spyOn(migrationService, 'getStatusItems').mockResolvedValueOnce([]);

        await migrationService.up();

        expect(spyFindOneAndUpdateOnMockCatalogModel).not.toHaveBeenCalled();
      });

      it('should run all pending migration files', async () => {
        jest.spyOn(migrationService, 'getStatusItems').mockResolvedValueOnce([
          { fileName: testMigrationDir.get('migration_1'), appliedAt: 'PENDING' },
          { fileName: testMigrationDir.get('migration_2'), appliedAt: 'PENDING' },
        ]);

        await migrationService.up();

        expect(spyFindOneAndUpdateOnMockCatalogModel).toHaveBeenNthCalledWith(
          1,
          {
            fileName: testMigrationDir.get('migration_1'),
          },
          expect.anything(),
          { upsert: true },
        );
        expect(spyFindOneAndUpdateOnMockCatalogModel).toHaveBeenNthCalledWith(
          2,
          {
            fileName: testMigrationDir.get('migration_2'),
          },
          expect.anything(),
          { upsert: true },
        );
      });

      it('should run all pending migration files in dry run mode (2 out of 2)', async () => {
        jest.spyOn(migrationService, 'getStatusItems').mockResolvedValueOnce([
          { fileName: testMigrationDir.get('migration_1'), appliedAt: 'PENDING' },
          { fileName: testMigrationDir.get('migration_2'), appliedAt: 'PENDING' },
        ]);

        await migrationService.up(true);

        expect(spyFindOneAndUpdateOnMockCatalogModel).not.toHaveBeenCalled();
      });

      it('should run all pending migration files in dry run mode (2 out of 2)', async () => {
        jest.spyOn(migrationService, 'getStatusItems').mockResolvedValueOnce([
          { fileName: testMigrationDir.get('migration_1'), appliedAt: 'PENDING' },
          { fileName: testMigrationDir.get('migration_2'), appliedAt: 'PENDING' },
        ]);

        await migrationService.up(true);

        expect(spyFindOneAndUpdateOnMockCatalogModel).not.toHaveBeenCalled();
      });

      it('should run only pending migration files', async () => {
        jest.spyOn(migrationService, 'getStatusItems').mockResolvedValueOnce([
          {
            fileName: testMigrationDir.get('migration_1'),
            appliedAt: faker.date.past().toString(),
          },
          { fileName: testMigrationDir.get('migration_2'), appliedAt: 'PENDING' },
        ]);

        await migrationService.up();

        expect(spyFindOneAndUpdateOnMockCatalogModel).toHaveBeenCalledTimes(1);
        expect(spyFindOneAndUpdateOnMockCatalogModel).toHaveBeenCalledWith(
          {
            fileName: testMigrationDir.get('migration_2'),
          },
          expect.anything(),
          { upsert: true },
        );
      });
    });

    describe('`down` command', () => {
      it('should do nothing if there are no items in changelog', async () => {
        jest.spyOn(migrationService, 'getStatusItems').mockResolvedValueOnce([]);

        await migrationService.down();

        expect(spyDeleteOneOnMockCatalogModel).not.toHaveBeenCalled();
      });

      it('should undo latest migration only', async () => {
        jest.spyOn(migrationService, 'getStatusItems').mockResolvedValueOnce([
          {
            fileName: testMigrationDir.get('migration_1'),
            appliedAt: faker.date.past().toString(),
          },
          {
            fileName: testMigrationDir.get('migration_2'),
            appliedAt: faker.date.past().toString(),
          },
        ]);

        await migrationService.down();

        expect(spyDeleteOneOnMockCatalogModel).toHaveBeenCalledTimes(1);
        expect(spyDeleteOneOnMockCatalogModel).toHaveBeenCalledWith({
          fileName: testMigrationDir.get('migration_2'),
        });
      });

      it('should undo requested migration only', async () => {
        jest.spyOn(migrationService, 'getStatusItems').mockResolvedValueOnce([
          {
            fileName: testMigrationDir.get('migration_1'),
            appliedAt: faker.date.past().toString(),
          },
          {
            fileName: testMigrationDir.get('migration_2'),
            appliedAt: faker.date.past().toString(),
          },
        ]);

        await migrationService.down(false, testMigrationDir.get('migration_1'));

        expect(spyDeleteOneOnMockCatalogModel).toHaveBeenCalledTimes(1);
        expect(spyDeleteOneOnMockCatalogModel).toHaveBeenCalledWith({
          fileName: testMigrationDir.get('migration_1'),
        });
      });

      it('should not update change log in dry-run mode', async () => {
        jest.spyOn(migrationService, 'getStatusItems').mockResolvedValueOnce([
          {
            fileName: testMigrationDir.get('migration_1'),
            appliedAt: faker.date.past().toString(),
          },
          {
            fileName: testMigrationDir.get('migration_2'),
            appliedAt: faker.date.past().toString(),
          },
        ]);

        await migrationService.down(true);

        expect(spyDeleteOneOnMockCatalogModel).not.toHaveBeenCalled();
      });
    });
  });
});
