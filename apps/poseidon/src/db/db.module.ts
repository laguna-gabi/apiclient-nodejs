import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigsService, ProvidersModule } from '../providers';

@Module({
  imports: [
    MongooseModule.forRootAsync({ imports: [ProvidersModule], useExisting: ConfigsService }),
  ],
})
export class DbModule {}
