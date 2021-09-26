import * as config from 'config';
import { SchedulerRegistry } from '@nestjs/schedule';

export class BaseScheduler {
  constructor(protected readonly schedulerRegistry: SchedulerRegistry) {}

  public deleteTimeout({ id }: { id: string }) {
    if (this.schedulerRegistry.doesExists('timeout', id)) {
      this.schedulerRegistry.deleteTimeout(id);
    }
  }

  /**
   * Setting max alert time for 2 months to avoid alerting the max integer allowed in setTimeout.
   * Avoiding error: TimeoutOverflowWarning: 6988416489 does not fit into a 32-bit signed integer
   */
  protected getCurrentDateConfigs(): { gapDate: Date; maxDate: Date } {
    const gapDate = new Date();
    gapDate.setMinutes(gapDate.getMinutes() + config.get('scheduler.alertBeforeInMin'));
    const maxDate = new Date();
    maxDate.setMinutes(maxDate.getMinutes() + config.get('scheduler.maxAlertGapInMin'));

    return { gapDate, maxDate };
  }
}
