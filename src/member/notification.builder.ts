import { Injectable } from '@nestjs/common';
import { Member, MemberConfig, NotificationMetadata } from '.';
import {
  InternalNotificationMetadata,
  Logger,
  SendOneSignalNotification,
  SendSendBirdNotification,
  SendTwilioNotification,
} from '../common';
import { NotificationsService } from '../providers';
import { User } from '../user';
import { InternalNotificationType, NotificationType, Platform } from '@lagunahealth/pandora';

@Injectable()
export class NotificationBuilder {
  constructor(
    private readonly notificationsService: NotificationsService,
    readonly logger: Logger,
  ) {}

  async notify({
    member,
    memberConfig,
    user,
    type,
    metadata,
  }: {
    member: Member;
    memberConfig: MemberConfig;
    user: User;
    type: NotificationType;
    metadata: NotificationMetadata;
  }) {
    const orgName = member?.org.name;
    let path = metadata.path || {};
    if (type === NotificationType.call || type === NotificationType.video) {
      path = { path: 'call' };
    }

    if (type === NotificationType.textSms) {
      const sendSendBirdNotification: SendSendBirdNotification = {
        userId: user.id,
        sendBirdChannelUrl: metadata.sendBirdChannelUrl,
        message: metadata.content,
        notificationType: type,
        orgName,
        appointmentId: metadata.appointmentId,
      };
      await this.notificationsService.send({ sendSendBirdNotification });

      const sendTwilioNotification: SendTwilioNotification = {
        body: metadata.content,
        to: member.phone,
        orgName,
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
          content: metadata.content,
          orgName,
        };
        return this.notificationsService.send({ sendOneSignalNotification });
      } else {
        const sendTwilioNotification: SendTwilioNotification = {
          body: metadata.content,
          to: member.phone,
          orgName,
        };
        return this.notificationsService.send({ sendTwilioNotification });
      }
    }
  }

  async internalNotify({
    member,
    memberConfig,
    user,
    type,
    content,
    metadata,
  }: {
    member: Member;
    memberConfig: MemberConfig;
    user: User;
    type: InternalNotificationType;
    content: string;
    metadata: InternalNotificationMetadata;
  }) {
    const orgName = member?.org.name;
    switch (type) {
      case InternalNotificationType.textToMember: {
        if (memberConfig.platform === Platform.web || !memberConfig.isPushNotificationsEnabled) {
          const sendTwilioNotification: SendTwilioNotification = {
            orgName,
            body: content,
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
              path: metadata.path,
            },
            content,
            orgName,
          };
          return this.notificationsService.send({ sendOneSignalNotification });
        }
      }
      case InternalNotificationType.textSmsToMember: {
        const sendTwilioNotification: SendTwilioNotification = {
          body: content,
          to: member.phone,
          orgName,
        };
        return this.notificationsService.send({ sendTwilioNotification });
      }
      case InternalNotificationType.textSmsToUser: {
        const sendTwilioNotification: SendTwilioNotification = {
          body: content,
          to: user.phone,
          orgName,
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
            content,
            orgName,
          };
          return this.notificationsService.send({ sendOneSignalNotification });
        }
        return;
      }
      case InternalNotificationType.chatMessageToUser: {
        const sendSendBirdNotification: SendSendBirdNotification = {
          userId: member.id,
          sendBirdChannelUrl: metadata.sendBirdChannelUrl,
          message: content,
          notificationType: type,
          orgName,
        };
        return this.notificationsService.send({ sendSendBirdNotification });
      }
    }
  }

  async internalNotifyControlMember({
    content,
    phone,
    orgName,
  }: {
    content: string;
    phone: string;
    orgName: string;
  }) {
    const sendTwilioNotification: SendTwilioNotification = {
      body: content,
      to: phone,
      orgName,
    };
    return this.notificationsService.send({ sendTwilioNotification });
  }
}
