import { ClientSettings } from '../src/settings';
import { translation } from '../languages/en.json';
import { hosts } from 'config';

export const replaceConfigs = ({
  content,
  memberClient,
  userClient,
  appointmentId,
  appointmentTime,
}: {
  content: string;
  memberClient: ClientSettings;
  userClient: ClientSettings;
  appointmentId?: string;
  appointmentTime?: string;
}): string => {
  return content
    .replace('{{member.honorific}}', translation.honorific[memberClient.honorific])
    .replace('{{member.lastName}}', memberClient.lastName)
    .replace('{{user.firstName}}', userClient.firstName)
    .replace('{{org.name}}', memberClient.orgName)
    .replace('{{appointmentTime}}', appointmentTime)
    .replace('{{downloadLink}}', `${hosts.app}/download/${appointmentId}`)
    .replace('{{dynamicLink}}', `${hosts.dynamicLink}`);
};
