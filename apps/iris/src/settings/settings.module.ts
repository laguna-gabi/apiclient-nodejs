import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ClientSettings, ClientSettingsDto, SettingsService } from '.';
import { useFactoryOptions } from '../db';
import * as mongooseDelete from 'mongoose-delete';

@Module({
  imports: [
    MongooseModule.forFeatureAsync([
      {
        name: ClientSettings.name,
        useFactory: () => {
          return ClientSettingsDto.plugin(mongooseDelete, useFactoryOptions);
        },
      },
    ]),
  ],
  providers: [SettingsService],
  exports: [SettingsService],
})
export class SettingsModule {}
