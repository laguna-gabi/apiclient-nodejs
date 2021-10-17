import { Injectable } from '@nestjs/common';
import * as config from 'config';
import {
  InternalNotificationType,
  Logger,
  NotificationType,
  Platform,
  SendOneSignalNotification,
  SendSendBirdNotification,
  SendTwilioNotification,
} from '../common';
import { NotificationsService } from '../providers';

@Injectable()
export class NotificationBuilder {
  constructor(
    private readonly notificationsService: NotificationsService,
    readonly logger: Logger,
  ) {}

  async notify({ member, memberConfig, user, type, metadata }) {
    let path = {};
    if (type === NotificationType.call || type === NotificationType.video) {
      path = { path: 'call' };
    }

    if (type === NotificationType.textSms) {
      const sendSendBirdNotification: SendSendBirdNotification = {
        userId: user.id,
        sendBirdChannelUrl: metadata.sendBirdChannelUrl,
        message: metadata.content,
        notificationType: type,
      };
      await this.notificationsService.send({ sendSendBirdNotification });

      const sendTwilioNotification: SendTwilioNotification = {
        body: metadata.content,
        to: member.phone,
      };
      return this.notificationsService.send({ sendTwilioNotification });
    } else {
      if (memberConfig.platform !== Platform.web && memberConfig.isPushNotificationsEnabled) {
        const sendOneSignalNotification: SendOneSignalNotification = {
          platform: memberConfig.platform,
          externalUserId: memberConfig.externalUserId,
          data: {
            user: { id: user.id, firstName: user.firstName, avatar: user.avatar },
            member: { phone: member.phone },
            type,
            ...path,
            isVideo: type === NotificationType.video,
            peerId: metadata.peerId,
          },
          metadata,
        };
        return this.notificationsService.send({ sendOneSignalNotification });
      } else {
        const sendTwilioNotification: SendTwilioNotification = {
          body: metadata.content,
          to: member.phone,
        };
        return this.notificationsService.send({ sendTwilioNotification });
      }
    }
  }

  async internalNotify({ member, memberConfig, user, type, metadata }) {
    switch (type) {
      case InternalNotificationType.textToMember: {
        if (memberConfig.platform === Platform.web || !memberConfig.isPushNotificationsEnabled) {
          if (metadata.chatLink) {
            metadata.content += `${config
              .get('contents.appointmentReminderChatLink')
              .replace('@chatLink@', metadata.chatLink)}`;
          }
          const sendTwilioNotification: SendTwilioNotification = {
            body: metadata.content,
            to: member.phone,
          };
          return this.notificationsService.send({ sendTwilioNotification });
        } else {
          const sendOneSignalNotification: SendOneSignalNotification = {
            platform: memberConfig.platform,
            externalUserId: memberConfig.externalUserId,
            data: {
              user: { id: user.id, firstName: user.firstName, avatar: user.avatar },
              member: { phone: member.phone },
              type,
              isVideo: false,
            },
            metadata,
          };
          return this.notificationsService.send({ sendOneSignalNotification });
        }
      }
      case InternalNotificationType.textSmsToMember: {
        const sendTwilioNotification: SendTwilioNotification = {
          body: metadata.content,
          to: member.phone,
        };
        return this.notificationsService.send({ sendTwilioNotification });
      }
      case InternalNotificationType.textSmsToUser: {
        const sendTwilioNotification: SendTwilioNotification = {
          body: metadata.content,
          to: user.phone,
        };
        return this.notificationsService.send({ sendTwilioNotification });
      }
      case InternalNotificationType.chatMessageToMember: {
        if (memberConfig.platform !== Platform.web && memberConfig.isPushNotificationsEnabled) {
          const sendOneSignalNotification: SendOneSignalNotification = {
            platform: memberConfig.platform,
            externalUserId: memberConfig.externalUserId,
            data: {
              user: { id: user.id, firstName: user.firstName, avatar: user.avatar },
              member: { phone: member.phone },
              type,
              path: `connect/${member.id}/${user.id}`,
              isVideo: false,
            },
            metadata,
          };
          return this.notificationsService.send({ sendOneSignalNotification });
        }
        return;
      }
      case InternalNotificationType.chatMessageToUser: {
        const sendSendBirdNotification: SendSendBirdNotification = {
          userId: member.id,
          sendBirdChannelUrl: metadata.sendBirdChannelUrl,
          message: metadata.content,
          notificationType: type,
        };
        return this.notificationsService.send({ sendSendBirdNotification });
      }
    }
  }
}
