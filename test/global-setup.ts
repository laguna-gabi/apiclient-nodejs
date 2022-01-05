import { general } from 'config';

module.exports = async () => {
  process.env.TZ = general.get('timezone');
};
