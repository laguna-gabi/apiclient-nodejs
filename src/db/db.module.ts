import { MongooseModule } from '@nestjs/mongoose';
import { ProvidersModule } from '../providers';
import { ConfigsService } from '../providers/aws/configs.service';
import { Module } from '@nestjs/common';

@Module({
  imports: [
    MongooseModule.forRootAsync({ imports: [ProvidersModule], useExisting: ConfigsService }),
  ],
})
export class DbModule {}
