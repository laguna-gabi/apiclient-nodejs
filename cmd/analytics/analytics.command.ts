import * as fs from 'fs';
import { Command, CommandRunner, Option } from 'nest-commander';
import {
  AnalyticsService,
  AppointmentsMemberData,
  CoachDataAggregate,
  DefaultOutputDir,
  MemberData,
  MemberDataAggregate,
  SheetOption,
} from '.';

interface AnalyticsCommandOptions {
  debug?: boolean;
  sheet?: string;
  outDirName?: string;
}
@Command({
  name: 'analytics',
  description: 'Collect members and coachers data and generate .csv spreadsheets for analytics',
})
export class AnalyticsCommand implements CommandRunner {
  constructor(private readonly analyticsService: AnalyticsService) {}
  async run(_passedParam: string[], options?: AnalyticsCommandOptions): Promise<void> {
    let outFileName;
    await this.analyticsService.init();
    const timestamp = this.analyticsService.getDateTime();
    this.analyticsService.init(); // loading cache data

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
        options.sheet = SheetOption.members;
      }

      if (options?.outDirName !== undefined && options?.outDirName !== null) {
        outFileName = options?.outDirName;
      } else {
        // dump to output directory by default
        outFileName = DefaultOutputDir;
      }

      // create directory structure for outputs if needed
      if (!fs.existsSync(outFileName)) {
        fs.mkdirSync(outFileName, { recursive: true });
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
            '--------------- Generating Member .csv Sheet -------------------\n' +
            '----------------------------------------------------------------',
        );

        const memberProcessedData: MemberData[] = await Promise.all(
          membersDataAggregate.map(async (member) => {
            return this.analyticsService.buildMemberData(member);
          }),
        );

        this.analyticsService.dumpCSV(
          outFileName,
          SheetOption.members,
          timestamp,
          memberProcessedData,
        );
      }
      if (options.sheet === SheetOption.appointments || options.sheet === SheetOption.all) {
        console.debug(
          '\n----------------------------------------------------------------\n' +
            '------------ Generating Appointments .csv Sheet ----------------\n' +
            '----------------------------------------------------------------',
        );

        const appointmentsMemberProcessedData: AppointmentsMemberData[][] =
          membersDataAggregate.map((member) =>
            this.analyticsService.buildAppointmentsMemberData(member),
          );
        this.analyticsService.dumpCSV(
          outFileName,
          SheetOption.appointments,
          timestamp,
          [].concat(...appointmentsMemberProcessedData),
        );
      }
      if (options.sheet === SheetOption.coachers || options.sheet === SheetOption.all) {
        console.debug(
          '\n----------------------------------------------------------------\n' +
            '------------ Generating Coachers .csv Sheet ----------------\n' +
            '----------------------------------------------------------------',
        );

        this.analyticsService.dumpCSV(
          outFileName,
          SheetOption.coachers,
          timestamp,
          coachDataAggregate.map((coach) => this.analyticsService.buildCoachData(coach)),
        );
      }
    } catch (err) {
      console.error(`${AnalyticsCommand}: error: got: ${err.message} (${err.stack})`);
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
