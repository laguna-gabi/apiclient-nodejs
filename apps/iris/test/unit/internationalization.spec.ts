import { LogInternalKey, RegisterInternalKey, translation } from '@argus/pandora';
import { hosts } from 'config';
// eslint-disable-next-line max-len
import { translation as nsTranslation } from '../../../../libs/pandora/src/languages/NorthshoreBeta.json';
import { Internationalization } from '../../src/providers';
import { replaceConfigs } from '../common';
import { generateUpdateMemberSettingsMock, generateUpdateUserSettingsMock } from '../generators';

describe(`live: ${Internationalization.name}`, () => {
  const internationalization: Internationalization = new Internationalization();

  beforeAll(async () => {
    await internationalization.onModuleInit();
  });

  it('should use org language when sending message to a member', async () => {
    const contentKey = RegisterInternalKey.newMember;
    const recipientClient = generateUpdateMemberSettingsMock();
    recipientClient.orgName = 'NorthshoreBeta';
    const userClient = generateUpdateUserSettingsMock();

    let content = internationalization.getContents({
      contentKey,
      recipientClient,
      senderClient: userClient,
      extraData: { org: { name: recipientClient.orgName } },
    });
    content = content.replace('{{dynamicLink}}', hosts.get('dynamicLink'));

    const body = replaceConfigs({
      content: nsTranslation.contents[contentKey],
      memberClient: recipientClient,
      userClient,
    });
    expect(body).toEqual(content);
  });

  it('should use member language when sending message to a member', async () => {
    const contentKey = RegisterInternalKey.newRegisteredMemberNudge;

    const memberClient = generateUpdateMemberSettingsMock();
    const userClient = generateUpdateUserSettingsMock();
    const content = internationalization.getContents({
      contentKey: RegisterInternalKey.newRegisteredMemberNudge,
      recipientClient: memberClient,
      senderClient: userClient,
      extraData: { org: { name: memberClient.orgName } },
    });

    const body = replaceConfigs({
      content: translation.contents[contentKey],
      memberClient,
      userClient,
    });

    expect(body).toEqual(content);
  });

  it('should use default language when sending message to a user', async () => {
    const contentKey = LogInternalKey.memberNotFeelingWellMessage;

    const memberClient = generateUpdateMemberSettingsMock();
    const userClient = generateUpdateUserSettingsMock();
    const content = internationalization.getContents({
      contentKey,
      recipientClient: userClient,
      senderClient: memberClient,
      extraData: {},
    });

    expect(content).toMatch('logged a score that requires your attention');
  });
});
