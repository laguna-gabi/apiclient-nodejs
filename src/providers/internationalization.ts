import { BaseInternationalization, InternalKey, Language } from '@lagunahealth/pandora';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { cloneDeep } from 'lodash';
import { GetContentsParams } from '../common';

@Injectable()
export class Internationalization extends BaseInternationalization implements OnModuleInit {
  async onModuleInit() {
    await super.onModuleInit();
  }

  getContents(params: GetContentsParams) {
    const { contentKey, recipientClient, senderClient, extraData } = params;
    // eslint-disable-next-line max-len
    // if getContents is applied more than once the honorific value in recipientClient may be corrupted
    const updateRecipientClient = cloneDeep(recipientClient);

    const base = recipientClient.language || Language.en;
    if (recipientClient && recipientClient.honorific) {
      updateRecipientClient.honorific = this.i18n.t(`honorific.${recipientClient.honorific}`, {
        lng: base,
      });
    }
    if (senderClient && senderClient.honorific) {
      senderClient.honorific = this.i18n.t(`honorific.${senderClient.honorific}`, {
        lng: base,
      });
    }

    const replace =
      params.contentKey === InternalKey.appointmentScheduledUser ||
      params.contentKey === InternalKey.newChatMessageFromMember ||
      params.contentKey === InternalKey.assessmentSubmitAlert ||
      params.contentKey === InternalKey.memberNotFeelingWellMessage;

    return this.i18n.t(`contents.${contentKey}`, {
      member: replace ? senderClient : updateRecipientClient,
      user: replace ? updateRecipientClient : senderClient,
      ...extraData,
      org: replace ? { name: senderClient.orgName } : extraData.org,
      lng: this.supportedOrgNameLanguages.includes(recipientClient.orgName)
        ? recipientClient.orgName
        : base,
    });
  }
}
