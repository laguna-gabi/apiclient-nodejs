import { Controller, Get, HttpException, HttpStatus, Param, UseInterceptors } from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';
import { apiPrefix, LoggingInterceptor } from '../common';
import { Slots } from './slot.dto';
import { UserService } from './user.service';

@UseInterceptors(LoggingInterceptor)
@Controller(`${apiPrefix}/users`)
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Public()
  @Get('slots/:appointmentId')
  async getUserSlots(@Param() params): Promise<Slots> {
    try {
      return await this.userService.getSlots({ appointmentId: params.appointmentId });
    } catch (ex) {
      throw new HttpException(ex.message, HttpStatus.BAD_REQUEST);
    }
  }
}
