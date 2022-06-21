import { ConfigsService, ExternalConfigs, ZenDesk } from '../../src/providers';
import { mockGenerateUser } from '../generators';
import * as jwt from 'jsonwebtoken';

describe('live: zendesk', () => {
  it('should sign the user first & last name with zendesks token', async () => {
    const configService = new ConfigsService();
    const zendeskProvider = new ZenDesk(configService);
    const { firstName, lastName, email } = mockGenerateUser();

    await zendeskProvider.onModuleInit();
    const zendDeskSecret = await configService.getConfig(ExternalConfigs.zendesk.token);
    const result = await zendeskProvider.getAuthToken({ firstName, lastName, email });
    const decoded = jwt.verify(result, zendDeskSecret);
    expect(decoded).toEqual(
      expect.objectContaining({
        email,
        name: `${firstName} ${lastName}`,
      }),
    );
  });
});
