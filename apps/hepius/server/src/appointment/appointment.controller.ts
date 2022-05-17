import { Body, Controller, NotFoundException, Post, UseInterceptors } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AppointmentBase, AppointmentService, ScheduleAppointmentParams } from '.';
import { LoggerService, LoggingInterceptor, Public, apiPrefix } from '../common';
import { CommunicationResolver } from '../communication';
import { Bitly } from '../providers';
import { Appointment } from '@argus/hepiusClient';

@UseInterceptors(LoggingInterceptor)
@Controller(`${apiPrefix}/appointments`)
export class AppointmentController extends AppointmentBase {
  constructor(
    readonly appointmentService: AppointmentService,
    readonly communicationResolver: CommunicationResolver,
    readonly bitly: Bitly,
    readonly eventEmitter: EventEmitter2,
    readonly logger: LoggerService,
  ) {
    super(appointmentService, communicationResolver, bitly, eventEmitter, logger);
  }

  @Public()
  @Post('schedule')
  async scheduleAppointment(@Body() params: ScheduleAppointmentParams): Promise<Appointment> {
    const result = await super.scheduleAppointment(params);
    if (!result) {
      throw new NotFoundException();
    }
    return result;
  }
}
