import {
  Environments,
  GlobalEventType,
  IEventNotifySlack,
  SlackChannel,
  SlackIcon,
} from '@argus/pandora';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { analytics } from 'config';
import { existsSync, mkdirSync, unlinkSync } from 'fs';
import { Command, CommandRunner, Option } from 'nest-commander';
import { DataSource, QueryRunner } from 'typeorm';
import {
  AnalyticsService,
  AppointmentTable,
  AppointmentsMemberData,
  BarrierData,
  BarrierTable,
  BarrierTypeData,
  BarrierTypeTable,
  CoachData,
  CoachDataAggregate,
  CoachTable,
  DefaultOutputDir,
  MemberData,
  MemberDataAggregate,
  MemberTable,
  QuestionnaireResponseData,
  SheetOption,
} from '.';
import { delay } from '../../src/common';
import { ConfigsService, ExternalConfigs, StorageService } from '../../src/providers';
import * as Importer from './importer/mysql-import';
import { CaregiverData, CaregiverTable, QuestionnaireResponseTable } from './index';

interface AnalyticsCommandOptions {
  debug?: boolean;
  sheet?: string;
  outDirName?: string;
}
@Command({
  name: 'analytics',
  description: 'Collect data from Harmony and write to relational database (mysql)',
})
export class AnalyticsCommand implements CommandRunner {
  queryRunner: QueryRunner;
  constructor(
    private readonly analyticsService: AnalyticsService,
    private readonly configsService: ConfigsService,
    private readonly storageService: StorageService,
    private readonly eventEmitter: EventEmitter2,
  ) {}
  async run(_passedParam: string[], options?: AnalyticsCommandOptions): Promise<void> {
    let outFileName;
    let criticalError;

    await this.analyticsService.init();
    const timestamp = this.analyticsService.getDateTime();
    this.analyticsService.init(); // loading cache data

    // initialize Analytics SQL db
    const { dbUsername, dbPassword } = ExternalConfigs.analytics;

    const { username, password } =
      !process.env.NODE_ENV || process.env.NODE_ENV === Environments.test
        ? analytics
        : {
            username: await this.configsService.getConfig(dbUsername),
            password: await this.configsService.getConfig(dbPassword),
          };

    const AppDataSource = new DataSource({
      type: 'mysql',
      host: analytics.host,
      port: 3306,
      username,
      password,
      database: analytics.database,
      entities: [
        CoachData,
        AppointmentsMemberData,
        MemberData,
        CaregiverData,
        QuestionnaireResponseData,
        BarrierTypeData,
        BarrierData,
      ],
      synchronize: true,
      logging: false,
    });

    const importer = new Importer(
      {
        host: analytics.host,
        user: username,
        password,
        database: analytics.database,
      },
      { delimiter: ';\n' },
    );

    await AppDataSource.initialize();

    this.queryRunner = AppDataSource.createQueryRunner();

    try {
      /***************************** Resolve Command Options  *************************************/
      if (options?.debug) {
        console.log(`${AnalyticsCommand.name}: running in debug mode`);
      }

      if (options?.sheet !== undefined && options?.sheet !== null) {
        if (Object.values(SheetOption).includes(options.sheet as SheetOption)) {
        } else {
          throw new Error(
            `invalid sheet option - ${options?.sheet} - supporting: ${JSON.stringify(
              Object.values(SheetOption),
            )} `,
          );
        }
      } else {
        // dump member sheet by default
        options.sheet = SheetOption.all;
      }

      if (options?.outDirName !== undefined && options?.outDirName !== null) {
        outFileName = options?.outDirName;
      } else {
        // dump to output directory by default
        outFileName = DefaultOutputDir;
      }

      // create directory structure for outputs if needed
      if (!existsSync(outFileName)) {
        mkdirSync(outFileName, { recursive: true });
      }

      /***************************** Aggregate Data for Analytics  ********************************/
      let membersDataAggregate: MemberDataAggregate[];
      let coachDataAggregate: CoachDataAggregate[];

      if (
        [SheetOption.members, SheetOption.appointments, SheetOption.all].includes(
          options.sheet as SheetOption,
        )
      ) {
        membersDataAggregate = (await this.analyticsService.getMemberDataAggregate()).concat(
          await this.analyticsService.getAllControl(),
        );

        if (options.debug) {
          this.analyticsService.writeToFile(
            outFileName,
            SheetOption.members,
            timestamp,
            membersDataAggregate,
          );
        }
      }

      if ([SheetOption.coachers, SheetOption.all].includes(options.sheet as SheetOption)) {
        coachDataAggregate = await this.analyticsService.getCoachersDataAggregate();

        if (options.debug) {
          this.analyticsService.writeToFile(
            outFileName,
            SheetOption.coachers,
            timestamp,
            coachDataAggregate,
          );
        }
      }

      /***************************** Generate Analytics Data **************************************/
      if (options.sheet === SheetOption.members || options.sheet === SheetOption.all) {
        console.debug(
          '\n----------------------------------------------------------------\n' +
            '---------- Generating Member Data ------------------------------\n' +
            '----------------------------------------------------------------',
        );

        const memberProcessedData: MemberData[] = await Promise.all(
          membersDataAggregate.map(async (member) => {
            return this.analyticsService.buildMemberData(member);
          }),
        );
        // Save to Analytics (MySQL) db:
        const memberTable = await this.queryRunner.getTable(MemberTable);

        if (memberTable) {
          await this.queryRunner.clearTable(MemberTable);
        }
        await Promise.all(
          memberProcessedData.map(async (member) => {
            const memberData = new MemberData();
            Object.assign(memberData, member);
            await AppDataSource.manager.save(memberData);
          }),
        );
      }
      if (options.sheet === SheetOption.appointments || options.sheet === SheetOption.all) {
        console.debug(
          '\n----------------------------------------------------------------\n' +
            '---------- Generating Appointments Data ------------------------\n' +
            '----------------------------------------------------------------',
        );

        const appointmentsMemberProcessedData: AppointmentsMemberData[][] =
          membersDataAggregate.map((member) =>
            this.analyticsService.buildAppointmentsMemberData(member),
          );

        // Save to Analytics (MySQL) db:
        const appointmentTable = await this.queryRunner.getTable(AppointmentTable);

        if (appointmentTable) {
          await this.queryRunner.clearTable(AppointmentTable);
        }

        await Promise.all(
          [].concat(...appointmentsMemberProcessedData).map(async (appointmentMemberData) => {
            const appointmentData = new AppointmentsMemberData();
            Object.assign(appointmentData, appointmentMemberData);
            await AppDataSource.manager.save(appointmentData);
          }),
        );
      }
      if (options.sheet === SheetOption.coachers || options.sheet === SheetOption.all) {
        console.debug(
          '\n----------------------------------------------------------------\n' +
            '---------- Generating Coachers Data ----------------------------\n' +
            '----------------------------------------------------------------',
        );

        // Save to Analytics (MySQL) db:
        const coachTable = await this.queryRunner.getTable(CoachTable);

        if (coachTable) {
          await this.queryRunner.clearTable(CoachTable);
        }

        await Promise.all(
          coachDataAggregate.map(async (coach) => {
            const coachData = new CoachData();
            Object.assign(coachData, this.analyticsService.buildCoachData(coach));
            await AppDataSource.manager.save(coachData);
          }),
        );
      }

      if (options.sheet === SheetOption.caregivers || options.sheet === SheetOption.all) {
        console.debug(
          '\n----------------------------------------------------------------\n' +
            '---------- Generating Caregiver Data ---------------------------\n' +
            '----------------------------------------------------------------',
        );

        // Save to Analytics (MySQL) db:
        const caregiverTable = await this.queryRunner.getTable(CaregiverTable);

        if (caregiverTable) {
          await this.queryRunner.clearTable(CaregiverTable);
        }

        await AppDataSource.manager.save(await this.analyticsService.getCaregiversData());
      }

      if (options.sheet === SheetOption.qrs || options.sheet === SheetOption.all) {
        console.debug(
          '\n----------------------------------------------------------------\n' +
            '---------- Generating Questionnaire Response Data --------------\n' +
            '----------------------------------------------------------------',
        );

        // Save to Analytics (MySQL) db:
        const qrTable = await this.queryRunner.getTable(QuestionnaireResponseTable);

        if (qrTable) {
          await this.queryRunner.clearTable(QuestionnaireResponseTable);
        }

        await AppDataSource.manager.save(
          await this.analyticsService.getQuestionnaireResponseData(),
        );
      }

      if (options.sheet === SheetOption.barriers || options.sheet === SheetOption.all) {
        console.debug(
          '\n----------------------------------------------------------------\n' +
            '------------------- Generating Barriers Data -------------------\n' +
            '----------------------------------------------------------------',
        );

        const barrierTypesTable = await this.queryRunner.getTable(BarrierTypeTable);
        if (barrierTypesTable) {
          await this.queryRunner.clearTable(BarrierTypeTable);
        }
        await AppDataSource.manager.save(await this.analyticsService.getBarrierTypesData());

        const barriersTable = await this.queryRunner.getTable(BarrierTable);
        if (barriersTable) {
          await this.queryRunner.clearTable(BarrierTable);
        }
        await AppDataSource.manager.save(await this.analyticsService.getBarriersData());
      }

      /***************************** Import Data Enrichment  **************************************/
      await this.storageService.downloadFile(
        analytics.storage,
        analytics.dataEnrichmentKey,
        './tmp.sql',
      );
      await importer.import('./tmp.sql');
      unlinkSync('./tmp.sql');
    } catch (err) {
      console.error(`${AnalyticsCommand.name}: error: got: ${err.message} (${err.stack})`);
      criticalError = err;
    }

    // Slack channel notification (pulse OR error indication)
    if (process.env.NODE_ENV === Environments.production) {
      const eventSlackMessageParams: IEventNotifySlack = {
        header: `*Analytics Auto Loader*`,
        message: criticalError
          ? `Auto Loader failed!\n\ngot: ${criticalError}`
          : `Auto Loader completed successfully`,
        icon: criticalError ? SlackIcon.critical : SlackIcon.info,
        channel: SlackChannel.analyticsAutoLoader,
      };
      this.eventEmitter.emit(GlobalEventType.notifySlack, eventSlackMessageParams);
      await delay(2000); // let the event settle before we exit
    }

    this.analyticsService.clean();
  }

  /**************************************** Command Options  **************************************/

  @Option({
    flags: '-d, --debug',
    description: 'run in debug mode',
    defaultValue: false,
  })
  parseDebug(): boolean {
    return true;
  }

  @Option({
    flags: '-s, --sheet [string]',
    description: `select a sheet to dump: {${Object.keys(SheetOption)}}`,
  })
  parseSheet(val: string): string {
    return val;
  }

  @Option({
    flags: '-o, --out [string]',
    description: 'select an output directory',
  })
  parseFile(val: string): string {
    return val;
  }
}
