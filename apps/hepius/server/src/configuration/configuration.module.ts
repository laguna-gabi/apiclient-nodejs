import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CommonModule } from '../common';
import { MobileVersion, MobileVersionDto, MobileVersionResolver, MobileVersionService } from '.';

@Module({
  imports: [
    CommonModule,
    MongooseModule.forFeature([{ name: MobileVersion.name, schema: MobileVersionDto }]),
  ],
  providers: [MobileVersionResolver, MobileVersionService],
  controllers: [],
})
export class ConfigurationModule {}
