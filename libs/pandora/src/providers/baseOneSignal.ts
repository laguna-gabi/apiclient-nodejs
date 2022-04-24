import { CancelNotificationType, NotificationType, Platform } from '..';
import { OnModuleInit } from '@nestjs/common';

export abstract class BaseOneSignal implements OnModuleInit {
  protected readonly oneSignalUrl = 'https://onesignal.com/api/v1';
  protected defaultApiId: string;
  protected defaultApiKey: string;
  protected voipApiId: string;
  protected voipApiKey: string;

  abstract onModuleInit(): Promise<void>;

  protected async getApiId(
    platform: Platform,
    notificationType?: NotificationType | CancelNotificationType,
  ): Promise<string> {
    return this.isVoipProject(platform, notificationType) ? this.voipApiId : this.defaultApiId;
  }

  protected isVoipProject(
    platform: Platform,
    notificationType?: NotificationType | CancelNotificationType,
  ): boolean {
    return (
      platform === Platform.ios &&
      (!notificationType ||
        notificationType === NotificationType.call ||
        notificationType === NotificationType.video ||
        notificationType === CancelNotificationType.cancelVideo ||
        notificationType === CancelNotificationType.cancelCall)
    );
  }
}
