import { seed } from '../../scripts/seed';
import { Command, CommandRunner, Option } from 'nest-commander';
import { GeneralScriptTypes } from './general.dto';
import { getTokens } from '../../scripts/getTokens';

interface CommandOptions {
  type: string;
}

@Command({
  name: 'general',
  description: 'Run general purpose commands',
})
export class GeneralCommand implements CommandRunner {
  async run(_passedParam: string[], options?: CommandOptions): Promise<void> {
    switch (options?.type) {
      case GeneralScriptTypes.seed.toString():
        console.log(`running 'seed' script`);
        await seed();
        break;
      case GeneralScriptTypes.getTokens.toString():
        console.log(`running 'get tokens' script`);
        await getTokens();
        break;
      default:
        console.log(`command is not supported`);
    }
  }
  /**************************************** Command Options  **************************************/

  @Option({
    flags: '-t, --type [string]',
    required: true,
    description: `select a script type [${Object.keys(GeneralScriptTypes)}]`,
  })
  parseType(val: string): string {
    return val;
  }
}
