import { BaseAllExceptionsFilter } from '@argus/pandora';
import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import { Errors, LoggerService } from '.';

@Catch()
export class AllExceptionsFilter extends BaseAllExceptionsFilter implements ExceptionFilter {
  constructor(readonly logger: LoggerService) {
    super(logger, Errors.values());
  }

  catch(exception, host: ArgumentsHost) {
    super.catch(exception, host);
  }
}
