import { NotificationType, Platform } from '@lagunahealth/pandora';
import { Injectable } from '@nestjs/common';
import {
  CancelNotificationParams,
  OneSignal,
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
  constructor(
    private readonly twilio: Twilio,
    private readonly sendBird: SendBird,
    private readonly oneSignal: OneSignal,
  ) {}

  // TODO handle audit https://app.shortcut.com/laguna-health/story/2208/hepius-iris-pandora-cleanup
  async send(dispatch: Dispatch, clientSettings: ClientSettings) {
    if (dispatch.notificationType === NotificationType.textSms) {
      const sendSendBirdNotification = this.generateSendbirdParams(
        dispatch,
        clientSettings.orgName,
      );
      // this.logger.audit(AuditType.message, sendSendBirdNotification, this.send.name);
      await this.sendBird.send(sendSendBirdNotification);

      const sendTwilioNotification = this.generateTwilioParams(dispatch.content, clientSettings);
      // this.logger.audit(AuditType.message, sendTwilioNotification, this.send.name);
      return this.twilio.send(sendTwilioNotification);
    } else {
      if (clientSettings.platform !== Platform.web && clientSettings.isPushNotificationsEnabled) {
        const sendOneSignalNotification = this.generateOneSignalParams(dispatch, clientSettings);
        // this.logger.audit(AuditType.message, sendOneSignalNotification, this.send.name);
        return this.oneSignal.send(sendOneSignalNotification);
      } else {
        const sendTwilioNotification = this.generateTwilioParams(dispatch.content, clientSettings);
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
      userId: dispatch.senderClient.id,
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
    clientSettings: ClientSettings,
  ): SendOneSignalNotification {
    const { notificationType } = dispatch;
    let path = dispatch.path || {};
    if (notificationType === NotificationType.call || notificationType === NotificationType.video) {
      path = { path: 'call' };
    }

    return {
      platform: clientSettings.platform,
      externalUserId: clientSettings.externalUserId,
      data: {
        user: dispatch.senderClient,
        member: { phone: clientSettings.phone },
        type: notificationType,
        ...path,
        isVideo: notificationType === NotificationType.video,
        peerId: dispatch.peerId,
      },
      content: dispatch.content,
      orgName: clientSettings.orgName,
    };
  }
}
