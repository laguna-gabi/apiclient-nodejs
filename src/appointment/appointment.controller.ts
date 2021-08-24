import { Body, Controller, NotFoundException, Post } from '@nestjs/common';
import { AppointmentService } from './appointment.service';
import { apiPrefix } from '../common';
import { Appointment, ScheduleAppointmentParams } from './appointment.dto';

@Controller(`${apiPrefix}/appointments`)
export class AppointmentController {
  constructor(private readonly appointmentService: AppointmentService) {}

  @Post('schedule')
  async scheduleAppointment(@Body() params: ScheduleAppointmentParams): Promise<Appointment> {
    const result = await this.appointmentService.schedule(params);
    if (!result) {
      throw new NotFoundException();
    }
    return result;
  }
}
