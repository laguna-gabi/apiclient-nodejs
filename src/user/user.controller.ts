import { Controller, Get, Param } from '@nestjs/common';
import { apiPrefix } from '../common';
import { Slots } from './slot.dto';
import { UserService } from './user.service';

@Controller(`${apiPrefix}/users`)
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('slots/:appointmentId')
  async getUserSlots(@Param() params): Promise<Slots> {
    return this.userService.getSlots({ appointmentId: params.appointmentId });
  }
}
