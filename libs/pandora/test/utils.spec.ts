import { lorem } from 'faker';
import { PARAMS_PROVIDER_TOKEN, Params } from 'nestjs-pino';
import { BaseLogger } from '../src/baseLogger';
import { ServiceName } from '../src/interfaces';

describe('Utils', () => {
  describe('generateOrgNamePrefix', () => {
    it('should return empty string generateOrgNamePrefix on no orgName', () => {
      const logger = new BaseLogger(PARAMS_PROVIDER_TOKEN as Params, ServiceName.hepius);
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      expect(logger.generateOrgNamePrefix()).toEqual('');
    });

    it('should return org string generateOrgNamePrefix when orgName provided', () => {
      const orgName = lorem.word();
      const logger = new BaseLogger(PARAMS_PROVIDER_TOKEN as Params, ServiceName.hepius);
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      expect(logger.generateOrgNamePrefix(orgName)).toEqual(` [${orgName}] `);
    });
  });
});
