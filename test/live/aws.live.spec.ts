import { Storage } from '../../src/providers';
import * as fs from 'fs';
import * as axios from 'axios';
import * as config from 'config';

describe('run aws s3 live', () => {
  const tempFilePath = 'output.pdf';
  const storageFilePath = 'SAMPLE_Elma_Burnstein_Summary.pdf';

  afterAll(() => {
    fs.unlinkSync(tempFilePath);
  });

  it('should fetch sample file from aws storage', async () => {
    const storageProvider = new Storage();
    const url = await storageProvider.getUrl(storageFilePath);

    const link = await axios.default({ method: 'GET', url: url, responseType: 'stream' });
    link.data.pipe(fs.createWriteStream(tempFilePath));

    expect(url).toMatch(
      `${config.get(
        'providers.aws.storage.memberBucketName',
      )}.s3.amazonaws.com/public/${storageFilePath}`,
    );
    expect(url).toMatch(`X-Amz-Algorithm=AWS4-HMAC-SHA256`); //v4 signature
    expect(url).toMatch(`Amz-Expires=10800`); //expiration: 3 hours

    await new Promise((resolve, reject) => {
      link.data.on('end', () => {
        const result = fs.existsSync(tempFilePath);
        expect(result).toBeTruthy();

        const stats = fs.statSync(tempFilePath);
        expect(stats.size).toBeGreaterThan(0);

        resolve(true);
      });

      link.data.on('error', () => {
        reject();
      });
    });
  });
});
