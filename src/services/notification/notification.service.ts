import { Environments, formatEx } from '@lagunahealth/pandora';
import { HttpService, Injectable, OnModuleInit } from '@nestjs/common';
import { services } from 'config';
import { LoggerService } from '../../common';
import { CloudMapService } from '../../providers/aws';
import { Dispatch } from './notification.dto';

@Injectable()
export class NotificationService implements OnModuleInit {
  private namespace: string;
  constructor(
    private readonly logger: LoggerService,
    private readonly serviceDiscovery: CloudMapService,
    private readonly httpService: HttpService,
  ) {}

  async onModuleInit(): Promise<void> {
    this.namespace =
      !process.env.NODE_ENV || process.env.NODE_ENV === Environments.test
        ? `http://localhost:${services.notification.port}`
        : `http://${await this.serviceDiscovery.discoverInstance(services.notification.taskName)}:${
            services.notification.port
          }`;
  }

  async getDispatchesByClientSenderId(
    clientSenderId: string,
    projection?: string[],
  ): Promise<Dispatch[]> {
    try {
      const result = await this.httpService
        .get(`${this.namespace}/dispatches/${clientSenderId}`, {
          params: { status: 'done', projection: projection?.join(',') },
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
