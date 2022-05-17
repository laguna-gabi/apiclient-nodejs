import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Changelog, ChangelogDto, MigrationService } from '.';

@Module({
  imports: [MongooseModule.forFeature([{ name: Changelog.name, schema: ChangelogDto }])],
  providers: [MigrationService],
  exports: [MigrationService, MongooseModule],
})
export class MigrationModule {}
