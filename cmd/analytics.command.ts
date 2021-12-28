import * as fs from 'fs';
import { json2csv } from 'json-2-csv';
import { Command, CommandRunner, Option } from 'nest-commander';
import {
  AnalyticsService,
  AppointmentsMemberData,
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
  description: 'Collect members data and generate .csv spreadsheets for analytics',
})
export class AnalyticsCommand implements CommandRunner {
  constructor(private readonly analyticsService: AnalyticsService) {}
  async run(passedParam: string[], options?: AnalyticsCommandOptions): Promise<void> {
    let outFileName;
    const timestamp = Date.now();
    try {
      /***************************** Resolve Command Options  *************************************/
      if (options?.debug) {
        console.log(`Analytics: running in debug mode`);
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
      console.log(`Analytics: dumping ${options.sheet} sheet`);

      /***************************** Aggregate Data for Analytics  ********************************/
      console.debug(
        '\n----------------------------------------------------------------\n' +
          '---------------  Aggregate Data for Analytics ------------------\n' +
          '----------------------------------------------------------------',
      );
      const members: MemberDataAggregate[] = await this.analyticsService.getMemberDataAggregate();

      if (options.debug) {
        fs.writeFile(
          `${outFileName}/${timestamp}_aggregated.data.${
            process.env.NODE_ENV ? process.env.NODE_ENV : 'test'
          }.json`,
          JSON.stringify(members),
          function (err) {
            if (err) {
              console.error(err);
            } else {
              console.log(
                `Analytics: debug aggregated data (count: ${members.length} members) - saved`,
              );
            }
          },
        );
      }

      /***************************** Generate Analytics Data **************************************/
      if (options.sheet === SheetOption.members || options.sheet === SheetOption.all) {
        console.debug(
          '\n----------------------------------------------------------------\n' +
            '--------------- Generating Member .csv Sheet -------------------\n' +
            '----------------------------------------------------------------',
        );

        let memberProcessedData: MemberData[] = await Promise.all(
          members.map(async (member) => {
            return this.analyticsService.buildMemberData(member);
          }),
        );

        /**************************** Processing Control Members  *****************************************/
        const controlMembersData = await this.analyticsService.getControlMemberData(
          await this.analyticsService.getAllControl(),
        );
        memberProcessedData = memberProcessedData.concat(controlMembersData);

        /**************************** Creating an output .csv  ********************************************/

        json2csv(
          memberProcessedData,
          (err, csv) => {
            if (err) {
              console.error(err);
            } else {
              fs.writeFile(
                `${outFileName}/${timestamp}_dump.members.${
                  process.env.NODE_ENV ? process.env.NODE_ENV : 'test'
                }.csv`,
                csv,
                function (err) {
                  if (err) {
                    console.error(err);
                  } else {
                    console.log('Analytics: members CSV saved!');
                  }
                },
              );
            }
          },
          { emptyFieldValue: '' },
        );
      }
      if (options.sheet === SheetOption.appointments || options.sheet === SheetOption.all) {
        console.debug(
          '\n----------------------------------------------------------------\n' +
            '------------ Generating Appointments .csv Sheet ----------------\n' +
            '----------------------------------------------------------------',
        );

        const appointmentsMemberProcessedData: AppointmentsMemberData[][] = await Promise.all(
          members.map(async (member) => {
            return this.analyticsService.buildAppointmentsMemberData(member);
          }),
        );

        json2csv(
          [].concat(...appointmentsMemberProcessedData),
          (err, csv) => {
            if (err) {
              console.error(err);
            } else {
              fs.writeFile(
                `${outFileName}/${timestamp}_dump.appointments.${
                  process.env.NODE_ENV ? process.env.NODE_ENV : 'test'
                }.csv`,
                csv,
                function (err) {
                  if (err) {
                    console.error(err);
                  } else {
                    console.log('Analytics: appointments CSV saved!');
                  }
                },
              );
            }
          },
          { emptyFieldValue: '' },
        );
      }
    } catch (err) {
      console.error(`Analytics: error: got: ${err.message} (${err.stack})`);
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
    description: 'select a sheet to dump [members, appointments, all]}',
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
