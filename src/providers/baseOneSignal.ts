import {
  AllNotificationTypes,
  CancelNotificationType,
  InternalNotificationType,
  NotificationType,
  Platform,
} from '../enums';

export abstract class BaseOneSignal {
  protected readonly oneSignalUrl = 'https://onesignal.com/api/v1';
  protected defaultApiId: string;
  protected defaultApiKey: string;
  protected voipApiId: string;
  protected voipApiKey: string;

  abstract onModuleInit();

  protected async getApiId(
    platform: Platform,
    notificationType?: AllNotificationTypes,
  ): Promise<string> {
    return this.isVoipProject(platform, notificationType) ? this.voipApiId : this.defaultApiId;
  }

  protected isVoipProject(platform: Platform, notificationType?: AllNotificationTypes): boolean {
    return (
      platform === Platform.ios &&
      notificationType !== NotificationType.text &&
      notificationType !== CancelNotificationType.cancelText &&
      !(notificationType in InternalNotificationType)
    );
  }
}
