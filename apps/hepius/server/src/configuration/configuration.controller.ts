import { Body, Controller, Post, UseInterceptors } from '@nestjs/common';
import { LoggingInterceptor, Public, apiPrefix } from '../common';
import { CheckMobileVersionParams, CheckMobileVersionResponse, MobileVersionService } from '.';

@UseInterceptors(LoggingInterceptor)
@Controller(`${apiPrefix}/configuration`)
export class ConfigurationController {
  constructor(private readonly mobileVersionService: MobileVersionService) {}

  @Public()
  @Post('mobile-version/check')
  async checkMobileVersion(
    @Body() checkMobileVersionParams: CheckMobileVersionParams,
  ): Promise<CheckMobileVersionResponse> {
    return await this.mobileVersionService.checkMobileVersion(checkMobileVersionParams);
  }
}
