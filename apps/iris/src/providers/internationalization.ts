import {
  AlertInternalKey,
  AppointmentInternalKey,
  ChatInternalKey,
  LogInternalKey,
} from '@argus/irisClient';
import { BaseInternationalization, Language } from '@argus/pandora';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { GetContentsParams } from '../common';

@Injectable()
export class Internationalization extends BaseInternationalization implements OnModuleInit {
  async onModuleInit() {
    await super.onModuleInit();
  }

  getContents(params: GetContentsParams) {
    const { contentKey, recipientClient, senderClient, extraData } = params;

    const replace =
      params.contentKey === AppointmentInternalKey.appointmentScheduledUser ||
      params.contentKey === ChatInternalKey.newChatMessageFromMember ||
      params.contentKey === AlertInternalKey.assessmentSubmitAlert ||
      params.contentKey === LogInternalKey.memberNotFeelingWellMessage;

    return this.i18n.t(`contents.${contentKey}`, {
      member: replace ? senderClient : recipientClient,
      user: replace ? recipientClient : senderClient,
      ...extraData,
      org: replace ? { name: senderClient.orgName } : extraData.org,
      lng: this.supportedOrgNameLanguages.includes(recipientClient.orgName)
        ? recipientClient.orgName
        : recipientClient.language || Language.en,
    });
  }
}
