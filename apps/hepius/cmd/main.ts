import { CmdModule } from '.';
import { CommandFactory } from 'nest-commander';

const bootstrap = async () => {
  await CommandFactory.run(CmdModule);
  process.exit();
};

bootstrap();
