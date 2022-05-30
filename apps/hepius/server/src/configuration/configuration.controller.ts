import { Platform } from '@argus/pandora';
import { Controller, Get, Param, ParseEnumPipe, UseInterceptors } from '@nestjs/common';
import { CheckMobileVersionResponse, MobileVersionService } from '.';
import { LoggingInterceptor, Public, apiPrefix } from '../common';

@UseInterceptors(LoggingInterceptor)
@Controller(`${apiPrefix}/configuration`)
export class ConfigurationController {
  constructor(private readonly mobileVersionService: MobileVersionService) {}

  @Public()
  @Get('mobile-version/check/:version/:platform/:build')
  async checkMobileVersion(
    @Param('version') version,
    @Param('platform', new ParseEnumPipe(Platform)) platform: Platform,
    @Param('build') build,
  ): Promise<CheckMobileVersionResponse> {
    return await this.mobileVersionService.checkMobileVersion({ version, build, platform });
  }
}
