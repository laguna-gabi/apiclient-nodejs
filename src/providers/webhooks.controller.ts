import { Body, Controller, Post, UseInterceptors } from '@nestjs/common';
import { apiPrefix, webhooks, LoggingInterceptor, Logger } from '../common';

@UseInterceptors(LoggingInterceptor)
@Controller(`${apiPrefix}/${webhooks}`)
export class WebhooksController {
  private readonly logger = new Logger(WebhooksController.name);

  @Post(`sendbird`)
  async sendbird(@Body() payload) {
    this.logger.debug(JSON.stringify(payload), this.sendbird.name);
  }
}
