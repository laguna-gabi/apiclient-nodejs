import { Controller, Get, HttpException, HttpStatus, Param } from '@nestjs/common';
import { apiPrefix } from '../common';
import { Slots } from './slot.dto';
import { UserService } from './user.service';

@Controller(`${apiPrefix}/users`)
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('slots/:appointmentId')
  async getUserSlots(@Param() params): Promise<Slots> {
    try {
      return await this.userService.getSlots({ appointmentId: params.appointmentId });
    } catch (ex) {
      throw new HttpException(ex.message, HttpStatus.BAD_REQUEST);
    }
  }
}
