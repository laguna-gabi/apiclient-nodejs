import {
  CancelNotificationType,
  Categories,
  ContentKey,
  NotificationType,
  Platform,
} from '@argus/pandora';
import { Prop, Schema } from '@nestjs/mongoose';
import { SenderClient } from '../conductor';

export class BaseSendNotification {
  orgName?: string;
}

export class SendOneSignalNotification extends BaseSendNotification {
  platform: Platform;
  externalUserId: string;
  data: {
    user: SenderClient;
    member: { phone: string };
    peerId?: string;
    type: NotificationType | CancelNotificationType;
    contentKey: ContentKey;
    contentCategory: Categories;
    path?: string;
    isVideo: boolean;
    extraData?: string;
  };
  content?: string;
}

export class SendTwilioNotification extends BaseSendNotification {
  body: string;
  to: string;
}

export class SendSendBirdNotification extends BaseSendNotification {
  userId: string; //sender
  sendBirdChannelUrl: string;
  message: string;
  notificationType: NotificationType | CancelNotificationType;
  contentKey: ContentKey;
  contentCategory: Categories;
  appointmentId?: string;
  journalImageDownloadLink?: string;
  journalAudioDownloadLink?: string;
}

export class CancelNotificationParams extends BaseSendNotification {
  externalUserId: string;
  platform: Platform;
  data: {
    peerId?: string;
    type: CancelNotificationType;
    notificationId: string;
  };
}

export enum Provider {
  oneSignal = 'oneSignal',
  sendbird = 'sendbird',
  twilio = 'twilio',
  slack = 'slack',
}

@Schema({ versionKey: false, _id: false })
export class ProviderResult {
  @Prop()
  provider: Provider;

  @Prop()
  content?: string;

  @Prop()
  id: string; //message id returned as a result from the provider
}
