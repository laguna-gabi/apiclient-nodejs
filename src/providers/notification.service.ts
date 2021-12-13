import {
  AllNotificationTypes,
  InternalNotificationType,
  NotificationType,
  Platform,
} from '@lagunahealth/pandora';
import { Injectable } from '@nestjs/common';
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
import { hosts } from 'config';

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
    const downloadLink = dispatch.appointmentId
      ? await this.bitly.shortenLink(`${hosts.get('app')}/download/${dispatch.appointmentId}`)
      : undefined;

    const content = this.internationalization.getContents({
      contentKey: dispatch.contentKey,
      senderClient,
      recipientClient,
      notificationType: dispatch.notificationType,
      extraData: {
        org: {
          name: recipientClient.orgName,
        },
        appointmentTime: this.formatAppointmentTime(
          dispatch.notificationType,
          recipientClient.zipCode,
          dispatch.appointmentTime,
        ),
        downloadLink,
      },
    });

    if (dispatch.notificationType === NotificationType.textSms) {
      const sendSendBirdNotification = this.generateSendbirdParams(
        dispatch,
        recipientClient.orgName,
      );
      // this.logger.audit(AuditType.message, sendSendBirdNotification, this.send.name);
      return this.sendBird.send(sendSendBirdNotification);
      const sendTwilioNotification = this.generateTwilioParams(content, recipientClient);
      // this.logger.audit(AuditType.message, sendTwilioNotification, this.send.name);
      return this.twilio.send(sendTwilioNotification);
    } else {
      if (recipientClient.platform !== Platform.web && recipientClient.isPushNotificationsEnabled) {
        const sendOneSignalNotification = this.generateOneSignalParams(
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
  private generateSendbirdParams(dispatch: Dispatch, orgName: string): SendSendBirdNotification {
    return {
      userId: dispatch.senderClientId,
      sendBirdChannelUrl: dispatch.sendBirdChannelUrl,
      message: dispatch.content,
      notificationType: dispatch.notificationType,
      orgName,
      appointmentId: dispatch.appointmentId,
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

  private generateOneSignalParams(
    dispatch: Dispatch,
    content: string,
    recipientClient: ClientSettings,
    senderClient: ClientSettings,
  ): SendOneSignalNotification {
    const { notificationType } = dispatch;
    let path = dispatch.path || {};
    if (notificationType === NotificationType.call || notificationType === NotificationType.video) {
      path = { path: 'call' };
    }

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
        ...path,
        isVideo: notificationType === NotificationType.video,
        peerId: dispatch.peerId,
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
        notificationType === InternalNotificationType.textToMember
      ) {
        return;
        format(
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
