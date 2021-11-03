import { HttpModule } from '@nestjs/axios';
import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UserModule } from '../user';
import { Communication, CommunicationDto, CommunicationResolver, CommunicationService } from '.';
import { CommonModule } from '../common';
import { ProvidersModule } from '../providers';

@Module({
  imports: [
    ProvidersModule,
    forwardRef(() => UserModule),
    HttpModule,
    CommonModule,
    MongooseModule.forFeature([{ name: Communication.name, schema: CommunicationDto }]),
  ],
  providers: [CommunicationResolver, CommunicationService],
  exports: [CommunicationResolver, CommunicationService],
})
export class CommunicationModule {}
