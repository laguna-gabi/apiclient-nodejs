import { BaseInternationalization, Language } from '@argus/pandora';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { Member } from '../../src/member';
import { AlertType } from '../../src/common';

@Injectable()
export class Internationalization extends BaseInternationalization implements OnModuleInit {
  async onModuleInit() {
    await super.onModuleInit();
  }

  getAlerts(
    alertType: AlertType,
    data: { member: Member; assessmentScore?: string; assessmentName?: string; todoText?: string },
  ) {
    return this.i18n.t(`alerts.${alertType}`, {
      ...data,
      lng: Language.en,
    });
  }
}
