import { hosts } from 'config';
import { translation } from '../languages/en.json';
import { ClientSettings } from '../src/settings';

export const replaceConfigs = ({
  content,
  memberClient,
  userClient,
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
    .replace('{{dynamicLink}}', `${hosts.dynamicLink}`);
};
