import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Communication, CommunicationDto, CommunicationResolver, CommunicationService } from '.';
import { CommonModule } from '../common';
import { ProvidersModule } from '../providers';

@Module({
  imports: [
    ProvidersModule,
    HttpModule,
    CommonModule,
    MongooseModule.forFeature([{ name: Communication.name, schema: CommunicationDto }]),
  ],
  providers: [CommunicationResolver, CommunicationService],
  exports: [CommunicationResolver, CommunicationService],
})
export class CommunicationModule {}
