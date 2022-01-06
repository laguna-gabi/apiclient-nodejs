import { ContentKey } from '@lagunahealth/pandora';
import { ClientSettings } from '../settings';

export class GetContentsParams {
  contentKey: ContentKey;
  recipientClient?: ClientSettings;
  senderClient?: ClientSettings;
  extraData?: ExtraData;
}

export class ExtraData {
  org?: { name: string };
  appointmentStart?: string;
  gapMinutes?: string;
  appointmentTime?: string;
  chatLink?: string;
  scheduleLink?: string;
  dynamicLink?: string;
}
