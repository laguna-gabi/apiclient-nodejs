import { formatEx } from '@argus/pandora';
import { Injectable } from '@nestjs/common';
import * as AWS from 'aws-sdk';
import { aws } from 'config';
import { LoggerService } from '../../common';

@Injectable()
export class CloudMapService {
  private readonly serviceDiscovery = new AWS.ServiceDiscovery({
    region: aws.region,
  });

  constructor(private readonly logger: LoggerService) {}

  async discoverInstance(serviceName: string): Promise<string> {
    this.logger.info({ serviceName }, CloudMapService.name, this.discoverInstance.name);
    try {
      const response = await this.serviceDiscovery
        .discoverInstances({
          ServiceName: serviceName,
          NamespaceName: aws.cloudMap.namespace,
        })
        .promise();
      if (!response?.Instances.length || !response?.Instances[0].Attributes?.AWS_INSTANCE_IPV4) {
        throw new Error(`could not find instance ${serviceName}`);
      }
      return response?.Instances[0].Attributes?.AWS_INSTANCE_IPV4;
    } catch (ex) {
      this.logger.error(
        { serviceName, serviceNamespace: aws.cloudMap.namespace },
        CloudMapService.name,
        this.discoverInstance.name,
        formatEx(ex),
      );

      throw ex;
    }
  }
}
