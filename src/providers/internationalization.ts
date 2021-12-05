import { Injectable, OnModuleInit } from '@nestjs/common';
import * as en from '../../languages/en.json';
import * as es from '../../languages/es.json';
import * as i18next from 'i18next';
import {
  AllNotificationTypes,
  ContentKey,
  ExtraData,
  InternalNotificationType,
  Language,
} from '@lagunahealth/pandora';
import { ClientSettings } from '../settings';

export class GetContentsParams {
  contentKey: ContentKey;
  recipientClient?: ClientSettings;
  senderClient?: ClientSettings;
  extraData?: ExtraData;
  notificationType: AllNotificationTypes;
}

@Injectable()
export class InternationalizationService implements OnModuleInit {
  i18n = i18next as any; // typescript doesn't support the i18next library

  async onModuleInit() {
    await this.i18n.init({
      lng: Language.en,
      fallbackLng: Language.en,
      resources: { en, es },
      interpolation: { escapeValue: false },
    });
  }

  getContents(params: GetContentsParams) {
    const { contentKey, recipientClient, senderClient, extraData, notificationType } = params;
    const lng =
      notificationType === InternalNotificationType.textSmsToUser
        ? Language.en
        : recipientClient.language;

    if (recipientClient) {
      recipientClient.honorific = this.i18n.t(`honorific.${recipientClient.honorific}`, {
        member: recipientClient,
        lng,
      });
    }
    return this.i18n.t(`contents.${contentKey}`, {
      member: recipientClient,
      user: senderClient,
      ...extraData,
      lng,
    });
  }
}
