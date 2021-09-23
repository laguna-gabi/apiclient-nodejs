import { Injectable } from '@nestjs/common';
import { add, areIntervalsOverlapping, isSameDay, startOfDay } from 'date-fns';
import { Appointment, AppointmentStatus } from '../appointment';
import { Availability } from '../availability';

@Injectable()
export class SlotService {
  public getSlots(
    availabilities: Availability[],
    appointments: Appointment[],
    duration: number,
    maxNumOfSlots: number,
    start: Date = new Date(Date.now()),
  ): Date[] {
    // sort by start date
    availabilities.sort((a: any, b: any) => {
      a = new Date(a.start);
      b = new Date(b.start);
      return a - b;
    });
    const slots: Date[] = [];

    for (let index = 0; index < maxNumOfSlots; index++) {
      start = this.findSlot(availabilities, appointments, duration, start);
      slots.push(start);

      if (slots.length >= 5 && isSameDay(slots[slots.length - 1], slots[slots.length - 5])) {
        start = startOfDay(add(start, { days: 1 }));
      } else {
        start = add(start, { minutes: duration });
      }
    }

    return slots.filter((slot) => {
      return slot != null;
    });
  }

  private findSlot(
    availabilities: Availability[],
    appointments: Appointment[],
    duration: number,
    start: Date,
  ): Date {
    for (let index = 0; index < availabilities.length; index++) {
      if (this.validRange(availabilities[index], start, duration)) {
        let slot = availabilities[index].start;
        while (availabilities[index].end >= add(slot, { minutes: duration })) {
          if (slot >= start && this.noCollision(appointments, slot, duration)) {
            return slot;
          } else {
            slot = add(slot, { minutes: duration });
          }
        }
      }
    }
  }

  private validRange(availability: Availability, start: Date, duration: number): boolean {
    return availability.end >= add(start, { minutes: duration });
  }

  private noCollision(appointments: Appointment[], slot: Date, duration: number): boolean {
    return appointments.some((appointment) => {
      if (appointment.status === AppointmentStatus.scheduled) {
        return !areIntervalsOverlapping(
          { start: slot, end: add(slot, { minutes: duration }) },
          { start: appointment.start, end: appointment.end },
        );
      } else {
        return false;
      }
    });
  }
}
