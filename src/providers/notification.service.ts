import {
  AuditType,
  ClientCategory,
  InternalKey,
  InternalNotificationType,
  NotificationType,
  Platform,
  QueueType,
} from '@lagunahealth/pandora';
import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
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
import { EventType, Logger } from '../common';
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
    private readonly logger: Logger,
    protected readonly eventEmitter: EventEmitter2,
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
      this.logAudit(sendSendBirdNotification, this.send.name);
      return this.sendBird.send(sendSendBirdNotification);
    } else if (dispatch.notificationType === NotificationType.textSms) {
      const sendSendBirdNotification = this.generateSendbirdParams(
        dispatch,
        recipientClient.orgName,
        content,
      );
      this.logAudit(sendSendBirdNotification, this.send.name);
      await this.sendBird.send(sendSendBirdNotification);
      const sendTwilioNotification = this.generateTwilioParams(content, recipientClient);
      this.logAudit(sendTwilioNotification, this.send.name);
      return this.twilio.send(sendTwilioNotification);
    } else {
      if (recipientClient.platform !== Platform.web && recipientClient.isPushNotificationsEnabled) {
        const sendOneSignalNotification = await this.generateOneSignalParams(
          dispatch,
          content,
          recipientClient,
          senderClient,
        );
        this.logAudit(sendOneSignalNotification, this.send.name);
        return this.oneSignal.send(sendOneSignalNotification);
      } else {
        const sendTwilioNotification = this.generateTwilioParams(content, recipientClient);
        this.logAudit(sendTwilioNotification, this.send.name);
        return this.twilio.send(sendTwilioNotification);
      }
    }
  }

  async cancel(cancelNotificationParams: CancelNotificationParams) {
    this.logAudit(cancelNotificationParams, this.cancel.name);
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

    let content = this.internationalization.getContents({
      contentKey: dispatch.contentKey,
      senderClient,
      recipientClient,
      extraData: {
        org: { name: recipientClient.orgName },
        appointmentTime: this.formatAppointmentTime(recipientClient, dispatch.appointmentTime),
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
            recipientClient,
            extraData: { chatLink: dispatch.chatLink },
          });
        }
        break;
    }

    if (
      (recipientClient.platform === Platform.web || !recipientClient.isPushNotificationsEnabled) &&
      (dispatch.contentKey === InternalKey.newRegisteredMember ||
        dispatch.contentKey === InternalKey.newRegisteredMemberNudge ||
        dispatch.contentKey === InternalKey.logReminder)
    ) {
      content += `\n${hosts.get('dynamicLink')}`;
    }

    return content;
  }

  private generateSendbirdParams(
    dispatch: Dispatch,
    orgName: string,
    content?: string,
  ): SendSendBirdNotification {
    return {
      userId: dispatch.senderClientId,
      sendBirdChannelUrl: dispatch.sendBirdChannelUrl,
      message: dispatch.content || content,
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

  private formatAppointmentTime(recipientClient: ClientSettings, appointmentTime?: Date) {
    if (appointmentTime) {
      if (recipientClient.clientCategory === ClientCategory.member) {
        return format(
          utcToZonedTime(appointmentTime, lookup(recipientClient.zipCode)),
          `${this.scheduleAppointmentDateFormat} (z)`,
          { timeZone: lookup(recipientClient.zipCode) },
        );
      } else {
        return `${format(
          new Date(appointmentTime.toUTCString()),
          this.scheduleAppointmentDateFormat,
        )} (UTC)`;
      }
    }
  }

  private logAudit(payload, method: string) {
    const message = this.logger.formatAuditMessage(AuditType.message, payload, method);
    this.eventEmitter.emit(EventType.notifyQueue, { type: QueueType.audit, message });
  }
}
