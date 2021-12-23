import {
  AllNotificationTypes,
  ContentKey,
  ExtraData,
  InternalNotificationType,
  Language,
} from '@lagunahealth/pandora';
import { Injectable, OnModuleInit } from '@nestjs/common';
import * as i18next from 'i18next';
import { cloneDeep } from 'lodash';
import * as en from '../../languages/en.json';
import * as es from '../../languages/es.json';
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
    // eslint-disable-next-line max-len
    // if getContents is applied more than once the honorific value in recipientClient may be corrupted
    const updateRecipientClient = cloneDeep(recipientClient);
    const lng =
      notificationType === InternalNotificationType.textSmsToUser
        ? Language.en
        : recipientClient.language;

    if (recipientClient && recipientClient.honorific) {
      updateRecipientClient.honorific = this.i18n.t(`honorific.${recipientClient.honorific}`, {
        lng,
      });
    }
    if (senderClient && senderClient.honorific) {
      senderClient.honorific = this.i18n.t(`honorific.${senderClient.honorific}`, {
        lng,
      });
    }

    const replace =
      params.contentKey === ContentKey.appointmentScheduledUser ||
      params.contentKey === ContentKey.newChatMessageFromMember ||
      params.contentKey === ContentKey.memberNotFeelingWellMessage;
    return this.i18n.t(`contents.${contentKey}`, {
      member: replace ? senderClient : updateRecipientClient,
      user: replace ? updateRecipientClient : senderClient,
      ...extraData,
      lng,
    });
  }
}
