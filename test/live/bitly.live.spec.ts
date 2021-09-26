import { ConfigsService, Bitly } from '../../src/providers';
import { HttpService } from '@nestjs/axios';
import * as config from 'config';

/**
 * Currently we're on a bit.ly free plan, which has 1000 links for a month.
 * This test is only for debugging, so we'll diminish the number of calls to create a link.
 */
describe.skip('live: bitly actions', () => {
  let bitly: Bitly;

  beforeAll(async () => {
    const configService = new ConfigsService();
    const httpService = new HttpService();
    bitly = new Bitly(configService, httpService);
    await bitly.onModuleInit();
  });

  it('should shorten a link', async () => {
    //when running this, remove process.env.NODE_ENV === environments.test in shortenLink method.
    const link = await bitly.shortenLink(config.get('hosts.chat'));
    expect(link).toMatch('https://bit.ly');
  });
});
