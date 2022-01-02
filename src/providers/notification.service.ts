import {
  AllNotificationTypes,
  InternalKey,
  InternalNotificationType,
  NotificationType,
  Platform,
} from '@lagunahealth/pandora';
import { Injectable } from '@nestjs/common';
import { gapMinutes, hosts } from 'config';
import { format, utcToZonedTime } from 'date-fns-tz';
import { lookup } from 'zipcode-to-timezone';
import {
  Bitly,
  CancelNotificationParams,
  InternationalizationService,
  OneSignal,
  ProviderResult,
  SendBird,
  SendOneSignalNotification,
  SendSendBirdNotification,
  SendTwilioNotification,
  Twilio,
} from '.';
import { Dispatch } from '../conductor';
import { ClientSettings } from '../settings';

@Injectable()
export class NotificationsService {
  private readonly scheduleAppointmentDateFormat = `EEEE LLLL do 'at' p`;

  constructor(
    private readonly twilio: Twilio,
    private readonly sendBird: SendBird,
    private readonly oneSignal: OneSignal,
    private readonly bitly: Bitly,
    private readonly internationalization: InternationalizationService,
  ) {}

  // TODO handle audit https://app.shortcut.com/laguna-health/story/2208/hepius-iris-pandora-cleanup
  async send(
    dispatch: Dispatch,
    recipientClient: ClientSettings,
    senderClient: ClientSettings,
  ): Promise<ProviderResult> {
    if (
      !recipientClient.isAppointmentsReminderEnabled &&
      (dispatch.contentKey === InternalKey.appointmentReminder ||
        dispatch.contentKey === InternalKey.appointmentLongReminder)
    ) {
      return;
    }

    const content = await this.generateContent(dispatch, recipientClient, senderClient);

    if (
      dispatch.notificationType === InternalNotificationType.chatMessageToUser ||
      dispatch.notificationType === InternalNotificationType.chatMessageJournal
    ) {
      const sendSendBirdNotification = this.generateSendbirdParams(
        dispatch,
        recipientClient.orgName,
      );
      // this.logger.audit(AuditType.message, sendSendBirdNotification, this.send.name);
      return this.sendBird.send(sendSendBirdNotification);
    } else if (dispatch.notificationType === NotificationType.textSms) {
      const sendSendBirdNotification = this.generateSendbirdParams(
        dispatch,
        recipientClient.orgName,
      );
      // this.logger.audit(AuditType.message, sendSendBirdNotification, this.send.name);
      await this.sendBird.send(sendSendBirdNotification);
      const sendTwilioNotification = this.generateTwilioParams(content, recipientClient);
      // this.logger.audit(AuditType.message, sendTwilioNotification, this.send.name);
      return this.twilio.send(sendTwilioNotification);
    } else {
      if (recipientClient.platform !== Platform.web && recipientClient.isPushNotificationsEnabled) {
        const sendOneSignalNotification = await this.generateOneSignalParams(
          dispatch,
          content,
          recipientClient,
          senderClient,
        );
        // this.logger.audit(AuditType.message, sendOneSignalNotification, this.send.name);
        return this.oneSignal.send(sendOneSignalNotification);
      } else {
        const sendTwilioNotification = this.generateTwilioParams(content, recipientClient);
        // this.logger.audit(AuditType.message, sendTwilioNotification, this.send.name);
        return this.twilio.send(sendTwilioNotification);
      }
    }
  }

  async cancel(cancelNotificationParams: CancelNotificationParams) {
    // TODO https://app.shortcut.com/laguna-health/story/2208/hepius-iris-pandora-cleanup
    // this.logger.audit(AuditType.message, cancelNotificationParams, this.cancel.name);
    return this.oneSignal.cancel(cancelNotificationParams);
  }

  /*************************************************************************************************
   **************************************** Private methods ****************************************
   ************************************************************************************************/
  async generateContent(
    dispatch: Dispatch,
    recipientClient: ClientSettings,
    senderClient: ClientSettings,
  ) {
    if (dispatch.content) {
      return dispatch.content;
    }

    if (
      dispatch.notificationType === NotificationType.call ||
      dispatch.notificationType === NotificationType.video
    ) {
      return undefined;
    }

    const downloadLink = dispatch.appointmentId
      ? await this.bitly.shortenLink(`${hosts.get('app')}/download/${dispatch.appointmentId}`)
      : undefined;

    let content = this.internationalization.getContents({
      contentKey: dispatch.contentKey,
      senderClient,
      recipientClient,
      notificationType: dispatch.notificationType,
      extraData: {
        org: { name: recipientClient.orgName },
        appointmentTime: this.formatAppointmentTime(
          dispatch.notificationType,
          recipientClient.zipCode,
          dispatch.appointmentTime,
        ),
        downloadLink,
        dynamicLink: hosts.get('dynamicLink'),
        gapMinutes,
      },
    });

    switch (dispatch.contentKey) {
      case InternalKey.appointmentRequest:
        // decorate the content for appointment reminder based on client setting
        if (recipientClient.platform === Platform.web) {
          content += this.internationalization.getContents({
            contentKey: InternalKey.appointmentRequestLink,
            notificationType: dispatch.notificationType,
            recipientClient,
            extraData: { scheduleLink: dispatch.scheduleLink },
          }); // TODO: do we need InternalKey.appointmentReminderLink in POEditor?
        } else {
          if (!recipientClient.isPushNotificationsEnabled) {
            content += `\n${hosts.get('dynamicLink')}`;
          }
        }
        break;
      case InternalKey.appointmentReminder:
        if (recipientClient.platform === Platform.web) {
          content += this.internationalization.getContents({
            contentKey: InternalKey.appointmentReminderLink,
            notificationType: dispatch.notificationType,
            recipientClient,
            extraData: { chatLink: dispatch.chatLink },
          });
        }
        break;
    }

    if (
      (recipientClient.platform === Platform.web || !recipientClient.isPushNotificationsEnabled) &&
      (dispatch.contentKey === InternalKey.newRegisteredMember ||
        dispatch.contentKey === InternalKey.newRegisteredMemberNudge)
    ) {
      content += `\n${hosts.get('dynamicLink')}`;
    }

    return content;
  }

  private generateSendbirdParams(dispatch: Dispatch, orgName: string): SendSendBirdNotification {
    return {
      userId: dispatch.senderClientId,
      sendBirdChannelUrl: dispatch.sendBirdChannelUrl,
      message: dispatch.content,
      notificationType: dispatch.notificationType,
      orgName,
      appointmentId: dispatch.appointmentId,
      journalImageDownloadLink: dispatch.journalImageDownloadLink,
      journalAudioDownloadLink: dispatch.journalAudioDownloadLink,
    };
  }

  private generateTwilioParams(
    content: string,
    clientSettings: ClientSettings,
  ): SendTwilioNotification {
    return {
      body: content,
      to: clientSettings.phone,
      orgName: clientSettings.orgName,
    };
  }

  private async generateOneSignalParams(
    dispatch: Dispatch,
    content: string,
    recipientClient: ClientSettings,
    senderClient: ClientSettings,
  ): Promise<SendOneSignalNotification> {
    const { notificationType } = dispatch;
    const pathObject = dispatch.path ? { path: dispatch.path } : {};
    const extraDataObject =
      dispatch.notificationType === NotificationType.video ||
      dispatch.notificationType === NotificationType.call
        ? { extraData: JSON.stringify(await this.twilio.createPeerIceServers()) }
        : {};
    const peerIdObject = { peerId: dispatch.peerId } || {};

    return {
      platform: recipientClient.platform,
      externalUserId: recipientClient.externalUserId,
      data: {
        user: {
          id: senderClient.id,
          firstName: senderClient.firstName,
          avatar: senderClient.avatar,
        },
        member: { phone: recipientClient.phone },
        type: notificationType,
        isVideo: notificationType === NotificationType.video,
        ...pathObject,
        ...extraDataObject,
        ...peerIdObject,
      },
      content,
      orgName: recipientClient.orgName,
    };
  }

  private formatAppointmentTime(
    notificationType: AllNotificationTypes,
    zipCode: string,
    appointmentTime?: Date,
  ) {
    if (appointmentTime) {
      if (
        notificationType === InternalNotificationType.textSmsToMember ||
        notificationType === InternalNotificationType.textToMember ||
        notificationType === NotificationType.text ||
        notificationType === NotificationType.textSms
      ) {
        return format(
          utcToZonedTime(appointmentTime, lookup(zipCode)),
          `${this.scheduleAppointmentDateFormat} (z)`,
          { timeZone: lookup(zipCode) },
        );
      } else if (notificationType === InternalNotificationType.textSmsToUser) {
        return `${format(
          new Date(appointmentTime.toUTCString()),
          this.scheduleAppointmentDateFormat,
        )} (UTC)`;
      }
    }
  }
}
