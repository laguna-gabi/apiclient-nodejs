import { InternalNotificationType, NotificationType, Platform } from '@lagunahealth/pandora';
import { Injectable } from '@nestjs/common';
import * as config from 'config';
import { Member, MemberConfig, NotificationMetadata } from '.';
import {
  AllNotificationTypes,
  InternalNotificationMetadata,
  LoggerService,
  SendOneSignalNotification,
  SendSendBirdNotification,
  SendTwilioNotification,
} from '../common';
import { NotificationsService } from '../providers';
import { User } from '../user';

@Injectable()
export class NotificationBuilder {
  constructor(
    private readonly notificationsService: NotificationsService,
    readonly logger: LoggerService,
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
  }): Promise<string | void> {
    const orgName = member?.org.name;
    const path = { path: 'call' }; //no longer in use

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
        const peerServiceToken = await this.notificationsService.createPeerIceServers();
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
            extraData: JSON.stringify(peerServiceToken),
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
    type: AllNotificationTypes;
    content: string;
    metadata: InternalNotificationMetadata;
  }) {
    const orgName = member?.org.name;
    switch (type) {
      case InternalNotificationType.textToMember: {
        if (memberConfig.platform === Platform.web || !memberConfig.isPushNotificationsEnabled) {
          if (memberConfig.platform !== Platform.web) {
            content += `\n${config.get('hosts.dynamicLink')}`;
          }
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
      case InternalNotificationType.chatMessageJournal: {
        const sendSendBirdNotification: SendSendBirdNotification = {
          userId: member.id,
          sendBirdChannelUrl: metadata.sendBirdChannelUrl,
          message: content,
          notificationType: type,
          orgName,
          journalImageDownloadLink: metadata.journalImageDownloadLink,
          journalAudioDownloadLink: metadata.journalAudioDownloadLink,
        };
        return this.notificationsService.send({ sendSendBirdNotification });
      }
    }
  }
}
