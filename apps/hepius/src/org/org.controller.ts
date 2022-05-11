import { Controller, Get, HttpException, HttpStatus, Param, UseInterceptors } from '@nestjs/common';
import { ErrorType, Errors, LoggingInterceptor, Public, apiPrefix } from '../common';
import { Org, OrgService } from '.';

@UseInterceptors(LoggingInterceptor)
@Controller(`${apiPrefix}/orgs`)
export class OrgController {
  constructor(readonly orgService: OrgService) {}

  @Public()
  @Get('details/:code')
  async getOrgDetails(@Param('code') code: string): Promise<Org> {
    try {
      const org = await this.orgService.getByCode(code);

      if (!org) {
        throw new Error(Errors.get(ErrorType.orgMissing));
      }
      return org;
    } catch (ex) {
      throw new HttpException(ex.message, HttpStatus.BAD_REQUEST);
    }
  }
}
