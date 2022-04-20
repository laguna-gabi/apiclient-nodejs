import { general } from 'config';
import { Environments } from './libs/pandora/src';

module.exports = async () => {
  process.env.TZ = general.timezone;
  if (
    process.env.NODE_ENV === Environments.production ||
    process.env.NODE_ENV === Environments.develop
  ) {
    throw new Error(`running tests on ${process.env.NODE_ENV} environment is not allowed`);
  }
};
