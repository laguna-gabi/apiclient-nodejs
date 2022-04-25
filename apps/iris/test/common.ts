import { mongoConnectionStringSettings } from '@argus/pandora';
import { db, hosts } from 'config';
import { connect, disconnect } from 'mongoose';
import { ConfigsService, ExternalConfigs } from '../src/providers';
import { ClientSettings } from '../src/settings';

export const replaceConfigs = ({
  content,
  memberClient,
  userClient,
  appointmentTime,
  assessmentName,
  assessmentScore,
  senderInitials,
}: {
  content: string;
  memberClient: ClientSettings;
  userClient: ClientSettings;
  appointmentId?: string;
  appointmentTime?: string;
  assessmentName?: string;
  assessmentScore?: string;
  senderInitials?: string;
}): string => {
  return content
    .replace('{{member.firstName}}', memberClient.firstName)
    .replace('{{member.lastName}}', memberClient.lastName)
    .replace('{{user.firstName}}', userClient.firstName)
    .replace('{{user.lastName}}', userClient.lastName)
    .replace('{{org.name}}', memberClient.orgName)
    .replace('{{appointmentTime}}', appointmentTime)
    .replace('{{assessmentScore}}', assessmentScore)
    .replace('{{assessmentName}}', assessmentName)
    .replace('{{senderInitials}}', senderInitials)
    .replace('{{dynamicLink}}', `${hosts.dynamicLink}`);
};

export const dbConnect = async () => {
  const config = new ConfigsService();
  await connect(
    `${await config.getConfig(ExternalConfigs.db.connection)}/${
      db.name
    }${mongoConnectionStringSettings}`,
  );
};

export const dbDisconnect = async () => {
  await disconnect();
};
