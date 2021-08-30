import { MobilePlatform, SendNotificationParams } from '../common';

export interface INotifications {
  register({
    token,
    externalUserId,
  }: {
    token: string;
    externalUserId: string;
  }): Promise<string | undefined>;
  send(sendNotificationParams: SendNotificationParams): Promise<boolean>;
  unregister(playerId: string, mobilePlatform: MobilePlatform): Promise<void>;
}
