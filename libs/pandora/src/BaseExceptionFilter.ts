import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import { BaseLogger } from '.';

@Catch()
export class BaseAllExceptionsFilter implements ExceptionFilter {
  LogAsWarning: Set<string>;

  constructor(protected readonly logger: BaseLogger, logAsWarningErrors) {
    this.LogAsWarning = new Set([
      ...logAsWarningErrors,
      'Forbidden resource',
      'Unauthorized',
      'Argument passed in must be a single String of 12 bytes or a string of 24 hex characters',
    ]);
  }

  catch(exception, host: ArgumentsHost) {
    let args;

    if (host.getType() === 'http') {
      const res = host.switchToHttp();
      const { params, body } = res.getRequest();
      args = Object.keys(params).length > 0 ? { params } : {};
      args = Object.keys(body).length > 0 ? { ...args, body } : args;

      const statusCode =
        exception instanceof HttpException
          ? exception.getStatus()
          : HttpStatus.INTERNAL_SERVER_ERROR;

      const response = res.getResponse();
      response.status(statusCode).json(exception.response);
    } else if (host.getType() === 'rpc') {
      args = host.switchToRpc().getData();
    } else {
      args = host.getArgByIndex(1);
    }
    this.logException(exception, args);
  }

  private logException(exception, args) {
    const { ClassName, MethodName } = this.getClassNameAndMethodName(exception);
    const message = exception.response?.message?.toString() || exception.message || exception;
    if (this.LogAsWarning.has(message)) {
      // log as warning without stack trace
      this.logger.warn(Object.values(args)[0], ClassName, MethodName, { message });
    } else {
      // log as error with stack trace
      const stack = exception.stack.substring(exception.stack.indexOf('\n') + 1);
      this.logger.error(Object.values(args)[0], ClassName, MethodName, { message, stack });
    }
  }

  private getClassNameAndMethodName(exception) {
    const ClassNameAndMethodName = exception.stack
      .split('\n')[1]
      .replace('at', '')
      .trim()
      .split(' ')[0]
      .split('.');
    return { ClassName: ClassNameAndMethodName[0], MethodName: ClassNameAndMethodName[1] };
  }
}
