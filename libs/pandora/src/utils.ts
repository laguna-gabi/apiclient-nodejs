import { FailureReason } from '.';
import { address } from 'faker';
import { lookup } from 'zipcode-to-timezone';

export const generatePhone = () => {
  const random = () => Math.floor(Math.random() * 9) + 1;

  let phone = '+414';
  for (let i = 0; i < 8; i++) {
    phone += random().toString();
  }

  return phone;
};

export const generateZipCode = (): string => {
  while (true) {
    const zipCode = address.zipCode('#####');
    /**
     * On occasions, faker generates invalid zipcodes. we'll try to generate
     * timezone, if it worked, we'll return the zipCode and exit the loop
     * Usually this works in the 1st time, so rarely we'll do it twice.
     */
    const timeZone = lookup(zipCode);
    if (timeZone) {
      return zipCode;
    }
  }
};
/*******************************************************************************
 *********************************** Logger ***********************************
 ******************************************************************************/

export const formatEx = (ex): FailureReason => {
  return { message: ex.message, code: ex.code, stack: ex.stack };
};

export const mockLogger = (logger) => {
  jest.spyOn(logger, 'log').mockImplementation(() => undefined);
  jest.spyOn(logger, 'debug').mockImplementation(() => undefined);
  jest.spyOn(logger, 'error').mockImplementation(() => undefined);
  jest.spyOn(logger, 'info').mockImplementation(() => undefined);
  jest.spyOn(logger, 'warn').mockImplementation(() => undefined);
};

// mocking the process warnings in order to avoid the prettyPrint deprecation warning in the tests
export const mockProcessWarnings = () => {
  jest.spyOn(process, 'emitWarning').mockImplementation(() => undefined);
};
