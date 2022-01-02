import { InternalNotificationType } from '@lagunahealth/pandora';
import { Injectable } from '@nestjs/common';
import { Member } from '.';
import {
  AllNotificationTypes,
  InternalNotificationMetadata,
  LoggerService,
  SendSendBirdNotification,
} from '../common';
import { NotificationsService } from '../providers';

@Injectable()
export class NotificationBuilder {
  constructor(
    private readonly notificationsService: NotificationsService,
    readonly logger: LoggerService,
  ) {}

  async internalNotify({
    member,
    type,
    content,
    metadata,
  }: {
    member: Member;
    type: AllNotificationTypes;
    content: string;
    metadata: InternalNotificationMetadata;
  }) {
    const orgName = member?.org.name;
    switch (type) {
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
