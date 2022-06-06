import { Environments, ServiceName } from '@argus/pandora';
import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { MongooseModule } from '@nestjs/mongoose';
import { containers, services } from 'config';
import { Recording, RecordingDto, RecordingResolver, RecordingService } from '.';
import { CommonModule } from '../common';
import { JourneyModule } from '../journey';
import { ConfigsService, ExternalConfigs, ProvidersModule } from '../providers';

@Module({
  imports: [
    ProvidersModule,
    CommonModule,
    JourneyModule,
    MongooseModule.forFeature([{ name: Recording.name, schema: RecordingDto }]),
    ClientsModule.registerAsync([
      {
        name: ServiceName.poseidon,
        inject: [ConfigsService],
        imports: [ProvidersModule],
        useFactory: async (configsService: ConfigsService) => {
          const host =
            !process.env.NODE_ENV ||
            process.env.NODE_ENV === Environments.test ||
            process.env.NODE_ENV === Environments.localhost
              ? containers.poseidon
              : await configsService.getConfig(ExternalConfigs.host.poseidon);
          return {
            transport: Transport.TCP,
            options: { host, port: services.poseidon.tcpPort },
          };
        },
      },
    ]),
  ],
  providers: [RecordingResolver, RecordingService],
})
export class RecordingModule {}
