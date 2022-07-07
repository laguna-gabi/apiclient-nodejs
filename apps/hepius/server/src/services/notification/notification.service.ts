import { formatEx } from '@argus/pandora';
import { HttpService } from '@nestjs/axios';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { containers, services } from 'config';
import { LoggerService } from '../../common';
import { ConfigsService, ExternalConfigs } from '../../providers/aws';
import { Dispatch } from './notification.dto';

@Injectable()
export class NotificationService implements OnModuleInit {
  private namespace: string;
  constructor(
    private readonly logger: LoggerService,
    private readonly httpService: HttpService,
    private readonly configsService: ConfigsService,
  ) {}

  async onModuleInit(): Promise<void> {
    const uri = await this.configsService.getEnvConfig({
      external: ExternalConfigs.host.iris,
      local: containers.iris,
    });
    this.namespace = `http://${uri}:${services.iris.port}`;
  }

  async getDispatchesByClientSenderId(
    clientSenderId: string,
    projection?: string[],
    retryAttempt = 0,
  ): Promise<Dispatch[]> {
    try {
      const result = await this.httpService
        .get(`${this.namespace}/dispatches/${clientSenderId}`, {
          params: { status: 'done', projection: projection?.join(',') },
          timeout: services.timeout,
        })
        .toPromise();

      if (result.status === 200) {
        this.logger.info(
          { clientSenderId },
          NotificationService.name,
          this.getDispatchesByClientSenderId.name,
        );
        return result.data;
      } else {
        throw new Error(`request failed with code ${result.status}`);
      }
    } catch (ex) {
      if (
        ['ECONNREFUSED', 'ECONNABORTED', 'ENOTFOUND', 'ECONNRESET'].includes(ex.code) &&
        retryAttempt < services.retries
      ) {
        return this.getDispatchesByClientSenderId(clientSenderId, projection, ++retryAttempt);
      }

      this.logger.error(
        { clientSenderId },
        NotificationService.name,
        this.getDispatchesByClientSenderId.name,
        formatEx(ex),
      );
      throw ex;
    }
  }
}
