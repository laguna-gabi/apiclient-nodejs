import { Injectable } from '@nestjs/common';
import { add, areIntervalsOverlapping, isBefore, isSameDay, startOfDay } from 'date-fns';
import { Availability } from '../availability';
import { Appointment, AppointmentStatus } from '@argus/hepiusClient';

@Injectable()
export class SlotService {
  public getSlots(
    availabilities: Availability[],
    appointments: Appointment[],
    duration: number,
    maxNumOfSlots: number,
    start: Date = new Date(Date.now()),
    end?: Date,
  ): Date[] {
    // sort by start date
    availabilities.sort((a: Availability, b: Availability) => {
      return a.start.getTime() - b.start.getTime();
    });
    const slots: Date[] = [];

    // choose the max date between start and now
    start = new Date(Math.max(...[start, new Date(Date.now())].map(Number)));

    for (let index = 0; index < maxNumOfSlots; index++) {
      start = this.findSlot(availabilities, appointments, duration, start);
      if (!end || isBefore(start, end)) {
        slots.push(start);
      }

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
      if (availabilities[index].end >= add(start, { minutes: duration })) {
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

  private noCollision(appointments: Appointment[], slot: Date, duration: number): boolean {
    return !appointments.some((appointment) => {
      if (appointment.status === AppointmentStatus.scheduled) {
        return areIntervalsOverlapping(
          { start: slot, end: add(slot, { minutes: duration }) },
          { start: appointment.start, end: appointment.end },
        );
      } else {
        return false;
      }
    });
  }
}
