import { seed } from '../../scripts/seed';
import { Command, CommandRunner, Option } from 'nest-commander';
import { GeneralScriptTypes } from './general.dto';
import { seedLaguna } from '../../scripts/seedLagunaData';
import { newUser } from '../../scripts/seedNewUser';
import { generateToken } from '../../scripts/generateTokens';

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
      case GeneralScriptTypes.lagunaSeed.toString():
        console.log(`running 'laguna' seed`);
        await seedLaguna();
        break;
      case GeneralScriptTypes.newUser.toString():
        console.log(`running 'newUser'`);
        await newUser();
        break;
      case GeneralScriptTypes.seed.toString():
        console.log(`running 'seed' script`);
        await seed();
        break;
      case GeneralScriptTypes.createToken.toString():
        console.log(`running 'generate token' script`);
        await generateToken();
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
