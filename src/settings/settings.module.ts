import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ClientSettings, ClientSettingsDto, SettingsService } from '.';

@Module({
  imports: [MongooseModule.forFeature([{ name: ClientSettings.name, schema: ClientSettingsDto }])],
  providers: [SettingsService],
})
export class SettingsModule {}
