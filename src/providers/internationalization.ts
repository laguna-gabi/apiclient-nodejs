import { InternalKey, Language } from '@lagunahealth/pandora';
import { Injectable, OnModuleInit } from '@nestjs/common';
import * as i18next from 'i18next';
import { cloneDeep } from 'lodash';
import * as en from '../../languages/en.json';
import * as es from '../../languages/es.json';
import { GetContentsParams } from '../common';

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
    const { contentKey, recipientClient, senderClient, extraData } = params;
    // eslint-disable-next-line max-len
    // if getContents is applied more than once the honorific value in recipientClient may be corrupted
    const updateRecipientClient = cloneDeep(recipientClient);
    const lng = recipientClient.language || Language.en;

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
      params.contentKey === InternalKey.appointmentScheduledUser ||
      params.contentKey === InternalKey.newChatMessageFromMember ||
      params.contentKey === InternalKey.memberNotFeelingWellMessage;
    return this.i18n.t(`contents.${contentKey}`, {
      member: replace ? senderClient : updateRecipientClient,
      user: replace ? updateRecipientClient : senderClient,
      ...extraData,
      lng,
    });
  }
}
