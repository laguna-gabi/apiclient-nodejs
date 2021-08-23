import { ConfigsService, ExternalConfigs, StorageService } from '../../src/providers';
import * as fs from 'fs';
import * as axios from 'axios';

describe('live: aws', () => {
  describe('storage', () => {
    const tempFilePath = 'output.pdf';
    const storageFilePath = 'SAMPLE_Elma_Burnstein_Summary.pdf';

    afterAll(() => {
      fs.unlinkSync(tempFilePath);
    });

    it('should fetch sample file from aws storage', async () => {
      const configService = new ConfigsService();
      const storageProvider = new StorageService(configService);
      const url = await storageProvider.getUrl(storageFilePath);

      const link = await axios.default({ method: 'GET', url: url, responseType: 'stream' });
      link.data.pipe(fs.createWriteStream(tempFilePath));

      const bucketName = await configService.getConfig(ExternalConfigs.awsStorageMember);
      expect(url).toMatch(`${bucketName}.s3.amazonaws.com/public/documents/${storageFilePath}`);
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
});
