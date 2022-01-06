import { ContentKey, FailureReason } from '.';

export const generateOrgNamePrefix = (orgName?: string): string => {
  return `${orgName ? ` [${orgName}] ` : ''}`;
};

export const generateDispatchId = (contentKey: ContentKey, ...params: string[]) => {
  return params.length === 0 ? contentKey : `${contentKey}_${params.sort().join('_')}`;
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
