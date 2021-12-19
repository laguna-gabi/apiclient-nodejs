import { BaseLogger, ServiceName } from '../src';
import { datatype, lorem } from 'faker';
import { PARAMS_PROVIDER_TOKEN, Params, PinoLogger } from 'nestjs-pino';

const VALID_KEYS = new Set([
  'fieldWithString',
  'fieldWithNumber',
  'fieldWithTrue',
  'fieldWithFalse',
  'fieldWithJsonContent',
  'fieldWithUndefinedValue',
]);

describe(BaseLogger.name, () => {
  const logger = new BaseLogger(PARAMS_PROVIDER_TOKEN as Params, ServiceName.iris, VALID_KEYS);
  const methodName = 'testLogger';

  describe('should log params', () => {
    let spyOnPinoLoggerInfo;
    let spyOnPinoLoggerDebug;
    let spyOnPinoLoggerWarn;
    let spyOnPinoLoggerError;

    afterEach(() => {
      jest.clearAllMocks();
    });

    beforeEach(() => {
      spyOnPinoLoggerInfo = jest.spyOn(PinoLogger.prototype, 'info');
      spyOnPinoLoggerDebug = jest.spyOn(PinoLogger.prototype, 'debug');
      spyOnPinoLoggerWarn = jest.spyOn(PinoLogger.prototype, 'warn');
      spyOnPinoLoggerError = jest.spyOn(PinoLogger.prototype, 'error');
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
      console.log(params);
      console.log(JSON.stringify(params));

      expect(spyOnPinoLoggerInfo).toHaveBeenCalledWith({
        params,
        className: BaseLogger.name,
        methodName,
      });
      expect(spyOnPinoLoggerDebug).not.toBeCalled();
      expect(spyOnPinoLoggerWarn).not.toBeCalled();
      expect(spyOnPinoLoggerError).not.toBeCalled();
    });

    it('should log params for log level', () => {
      logger.log(params, BaseLogger.name, methodName);
      expect(spyOnPinoLoggerInfo).toHaveBeenCalledWith({
        params,
        className: BaseLogger.name,
        methodName,
      });
      expect(spyOnPinoLoggerDebug).not.toBeCalled();
      expect(spyOnPinoLoggerWarn).not.toBeCalled();
      expect(spyOnPinoLoggerError).not.toBeCalled();
    });

    it('should log params for debug level', () => {
      logger.debug(params, BaseLogger.name, methodName);
      expect(spyOnPinoLoggerDebug).toHaveBeenCalledWith({
        params,
        className: BaseLogger.name,
        methodName,
      });
      expect(spyOnPinoLoggerInfo).not.toBeCalled();
      expect(spyOnPinoLoggerWarn).not.toBeCalled();
      expect(spyOnPinoLoggerError).not.toBeCalled();
    });

    it('should log params for warn level', () => {
      logger.warn(params, BaseLogger.name, methodName, 'reason1', 'reason2');
      expect(spyOnPinoLoggerWarn).toHaveBeenCalledWith({
        params,
        className: BaseLogger.name,
        methodName,
        reasons: ['reason1', 'reason2'],
      });
      expect(spyOnPinoLoggerInfo).not.toBeCalled();
      expect(spyOnPinoLoggerDebug).not.toBeCalled();
      expect(spyOnPinoLoggerError).not.toBeCalled();
    });

    it('should log params for error level', () => {
      logger.error(params, BaseLogger.name, methodName, 'reason1', 'reason2');
      expect(spyOnPinoLoggerError).toHaveBeenCalledWith({
        params,
        className: BaseLogger.name,
        methodName,
        reasons: ['reason1', 'reason2'],
      });
      expect(spyOnPinoLoggerInfo).not.toBeCalled();
      expect(spyOnPinoLoggerDebug).not.toBeCalled();
      expect(spyOnPinoLoggerWarn).not.toBeCalled();
    });

    it('should not log params with null value', () => {
      const params = { fieldWithNumber: null };

      logger.info(params, BaseLogger.name, methodName);
      expect(spyOnPinoLoggerInfo).toHaveBeenCalledWith({
        params: {},
        className: BaseLogger.name,
        methodName,
      });
    });

    it('should not log params with undefined value', () => {
      const params = { fieldWithNumber: undefined };

      logger.info(params, BaseLogger.name, methodName);
      expect(spyOnPinoLoggerInfo).toHaveBeenCalledWith({
        params: {},
        className: BaseLogger.name,
        methodName,
      });
    });

    it('should not log params for field not in VALID_KEYS', () => {
      const params = { fieldNotExists: datatype.number() };

      logger.info(params, BaseLogger.name, methodName);
      expect(spyOnPinoLoggerInfo).toHaveBeenCalledWith({
        params: {},
        className: BaseLogger.name,
        methodName,
      });
    });

    it('should set empty array on validValues, if it is not provided', () => {
      const logger = new BaseLogger(PARAMS_PROVIDER_TOKEN as Params, ServiceName.hepius);
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      expect(logger.validKeys).toEqual(new Set<string>());
    });
  });
});
