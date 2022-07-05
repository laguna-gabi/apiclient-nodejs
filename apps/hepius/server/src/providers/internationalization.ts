import { BaseInternationalization, Language } from '@argus/pandora';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { Member } from '../member';
import { AlertType, ExtraData, InternalContentKey } from '../common';
import { AutoActionItemType } from '../actionItem';

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

  getActionItem(autoActionItemType: AutoActionItemType): { title: string; description: string } {
    return {
      title: this.i18n.t(`actionItems.${autoActionItemType}.title`, {
        lng: Language.en,
      }),
      description: this.i18n.t(`actionItems.${autoActionItemType}.description`, {
        lng: Language.en,
      }),
    };
  }

  getContents(params: { contentKey: InternalContentKey; extraData?: ExtraData }) {
    const { contentKey, extraData } = params;

    return this.i18n.t(`contents.${contentKey}`, {
      ...extraData,
      lng: Language.en,
    });
  }
}
