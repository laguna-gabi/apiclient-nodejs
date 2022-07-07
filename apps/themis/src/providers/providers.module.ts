import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { CommonModule } from '../common';
import { ConfigsService, ExternalConfigs, QueueService } from './aws';
import { containers, services } from 'config';
import { ServiceName } from '@argus/pandora';
import { HepiusClientService } from './hepius/client.service';

@Module({
  imports: [
    CommonModule,
    ClientsModule.registerAsync([
      {
        name: ServiceName.hepius,
        inject: [ConfigsService],
        imports: [ProvidersModule],
        useFactory: async (configsService: ConfigsService) => {
          const host = await configsService.getEnvConfig({
            external: ExternalConfigs.host.hepius,
            local: containers.hepius,
          });
          return {
            transport: Transport.TCP,
            options: { host, port: services.hepius.tcpPort },
          };
        },
      },
    ]),
  ],
  providers: [ConfigsService, QueueService, HepiusClientService],
  exports: [ConfigsService, QueueService, HepiusClientService],
})
export class ProvidersModule {}
