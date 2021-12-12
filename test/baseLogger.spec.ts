import { BaseLogger, ServiceName } from '../src';
import { datatype, lorem } from 'faker';

const VALID_KEYS = [
  'fieldWithString',
  'fieldWithNumber',
  'fieldWithTrue',
  'fieldWithFalse',
  'fieldWithJsonContent',
  'fieldWithUndefinedValue',
];

describe(BaseLogger.name, () => {
  const logger = new BaseLogger(ServiceName.iris, VALID_KEYS);
  const methodName = 'testLogger';

  describe('should log params', () => {
    afterEach(() => {
      jest.clearAllMocks();
    });

    beforeEach(() => {
      console.info = jest.fn();
      console.log = jest.fn();
      console.debug = jest.fn();
      console.warn = jest.fn();
      console.error = jest.fn();
    });

    const params = {
      fieldWithString: lorem.word(),
      fieldWithNumber: datatype.number(),
      fieldWithTrue: true,
      fieldWithFalse: false,
      fieldWithJsonContent: datatype.json(),
    };

    it('should log params for info level', () => {
      logger.info(params, BaseLogger.name, methodName);
      expect(console.info).toHaveBeenCalledWith(expect.stringContaining(JSON.stringify(params)));
      expect(console.debug).not.toBeCalled();
      expect(console.log).not.toBeCalled();
      expect(console.warn).not.toBeCalled();
      expect(console.error).not.toBeCalled();
    });

    it('should log params for log level', () => {
      logger.log(params, BaseLogger.name, methodName);
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining(JSON.stringify(params)));
      expect(console.debug).not.toBeCalled();
      expect(console.info).not.toBeCalled();
      expect(console.warn).not.toBeCalled();
      expect(console.error).not.toBeCalled();
    });

    it('should log params for debug level', () => {
      logger.debug(params, BaseLogger.name, methodName);
      expect(console.debug).toHaveBeenCalledWith(expect.stringContaining(JSON.stringify(params)));
      expect(console.log).not.toBeCalled();
      expect(console.info).not.toBeCalled();
      expect(console.warn).not.toBeCalled();
      expect(console.error).not.toBeCalled();
    });

    it('should log params for warn level', () => {
      logger.warn(params, BaseLogger.name, methodName);
      expect(console.warn).toHaveBeenCalledWith(expect.stringContaining(JSON.stringify(params)));
      expect(console.log).not.toBeCalled();
      expect(console.info).not.toBeCalled();
      expect(console.debug).not.toBeCalled();
      expect(console.error).not.toBeCalled();
    });

    it('should log params for error level', () => {
      logger.error(params, BaseLogger.name, methodName);
      expect(console.error).toHaveBeenCalledWith(expect.stringContaining(JSON.stringify(params)));
      expect(console.log).not.toBeCalled();
      expect(console.info).not.toBeCalled();
      expect(console.debug).not.toBeCalled();
      expect(console.warn).not.toBeCalled();
    });
  });

  it('should not log params with null value', () => {
    const params = { fieldWithNumber: null };

    logger.info(params, BaseLogger.name, methodName);
    expect(console.info).toHaveBeenCalledWith(expect.stringContaining(JSON.stringify({})));
  });

  it('should not log params with undefined value', () => {
    const params = { fieldWithNumber: undefined };

    logger.info(params, BaseLogger.name, methodName);
    expect(console.info).toHaveBeenCalledWith(expect.stringContaining(JSON.stringify({})));
  });

  it('should not log params for field not in VALID_KEYS', () => {
    const params = { fieldNotExists: datatype.number() };

    logger.info(params, BaseLogger.name, methodName);
    expect(console.info).toHaveBeenCalledWith(expect.stringContaining(JSON.stringify({})));
  });

  it('should set empty array on validValues, if it is not provided', () => {
    const logger = new BaseLogger(ServiceName.hepius);
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    expect(logger.validKeys).toEqual([]);
  });
});
