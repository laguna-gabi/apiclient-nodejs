import { HttpModule } from '@nestjs/axios';
import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UserModule } from '../user';
import { Communication, CommunicationDto, CommunicationResolver, CommunicationService } from '.';
import { CommonModule } from '../common';
import { ProvidersModule } from '../providers';
import { useFactoryOptions } from '../db';
import * as mongooseDelete from 'mongoose-delete';

@Module({
  imports: [
    ProvidersModule,
    forwardRef(() => UserModule),
    HttpModule,
    CommonModule,
    MongooseModule.forFeatureAsync([
      {
        name: Communication.name,
        useFactory: () => {
          return CommunicationDto.plugin(mongooseDelete, useFactoryOptions);
        },
      },
    ]),
  ],
  providers: [CommunicationResolver, CommunicationService],
  exports: [CommunicationResolver, CommunicationService],
})
export class CommunicationModule {}
