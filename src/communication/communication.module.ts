import { Module } from '@nestjs/common';
import { Communication, CommunicationDto, CommunicationResolver, CommunicationService } from '.';
import { MongooseModule } from '@nestjs/mongoose';
import { HttpModule } from '@nestjs/axios';
import { ProvidersModule } from '../providers/providers.module';

@Module({
  imports: [
    ProvidersModule,
    HttpModule,
    MongooseModule.forFeature([{ name: Communication.name, schema: CommunicationDto }]),
  ],
  providers: [CommunicationResolver, CommunicationService],
  exports: [CommunicationResolver, CommunicationService],
})
export class CommunicationModule {}
