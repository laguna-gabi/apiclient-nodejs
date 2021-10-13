import { MongooseModule } from '@nestjs/mongoose';
import { ProvidersModule, ConfigsService } from '../providers';
import { Module } from '@nestjs/common';

@Module({
  imports: [
    MongooseModule.forRootAsync({ imports: [ProvidersModule], useExisting: ConfigsService }),
  ],
})
export class DbModule {}
