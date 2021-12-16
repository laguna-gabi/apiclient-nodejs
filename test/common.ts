import { ClientSettings } from '../src/settings';
import { translation } from '../languages/en.json';
import { hosts } from 'config';

export const replaceConfigs = ({
  content,
  recipientClient,
  senderClient,
  appointmentId,
  appointmentTime,
}: {
  content: string;
  recipientClient: ClientSettings;
  senderClient: ClientSettings;
  appointmentId?: string;
  appointmentTime?: string;
}): string => {
  return content
    .replace('{{member.honorific}}', translation.honorific[recipientClient.honorific])
    .replace('{{member.lastName}}', recipientClient.lastName)
    .replace('{{user.firstName}}', senderClient.firstName)
    .replace('{{org.name}}', recipientClient.orgName)
    .replace('{{appointmentTime}}', appointmentTime)
    .replace('{{downloadLink}}', `${hosts.app}/download/${appointmentId}`);
};
