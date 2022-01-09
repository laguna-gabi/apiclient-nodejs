import {
  AllNotificationTypes,
  BaseOneSignal,
  CancelNotificationType,
  NotificationType,
  Platform,
} from '../src';
import { OnModuleInit } from '@nestjs/common';
import { v4 } from 'uuid';

class OneSignal extends BaseOneSignal implements OnModuleInit {
  async onModuleInit() {
    this.defaultApiId = v4();
    this.defaultApiKey = v4();
    this.voipApiId = v4();
    this.voipApiKey = v4();
  }

  getCredentials() {
    return {
      defaultApiId: this.defaultApiId,
      defaultApiKey: this.defaultApiKey,
      voipApiId: this.voipApiId,
      voipApiKey: this.voipApiKey,
    };
  }

  async getApiId(platform: Platform, notificationType?: AllNotificationTypes): Promise<string> {
    return super.getApiId(platform, notificationType);
  }

  isVoipProject(platform: Platform, notificationType?: AllNotificationTypes): boolean {
    return super.isVoipProject(platform, notificationType);
  }
}

describe(BaseOneSignal.name, () => {
  const oneSignal = new OneSignal();

  beforeAll(async () => {
    await oneSignal.onModuleInit();
  });

  test.each([
    undefined,
    NotificationType.call,
    NotificationType.video,
    CancelNotificationType.cancelCall,
    CancelNotificationType.cancelVideo,
  ])(`should get voip project configs on ${Platform.ios} device with type %p`, async (type) => {
    const isVoipResult = oneSignal.isVoipProject(Platform.ios);
    expect(isVoipResult).toBeTruthy();

    const result = await oneSignal.getApiId(Platform.ios, type);
    expect(result).toEqual(oneSignal.getCredentials().voipApiId);
  });

  test.each([
    undefined,
    ...Object.values(NotificationType),
    ...Object.values(CancelNotificationType),
  ])(
    `should get default project configs on ${Platform.android} device with type %p`,
    async (type) => {
      const isVoipResult = oneSignal.isVoipProject(Platform.android);
      expect(isVoipResult).toBeFalsy();

      const result = await oneSignal.getApiId(Platform.android, type);
      expect(result).toEqual(oneSignal.getCredentials().defaultApiId);
    },
  );
});
