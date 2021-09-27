import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Org, OrgDto, OrgResolver, OrgService } from '.';

@Module({
  imports: [MongooseModule.forFeature([{ name: Org.name, schema: OrgDto }])],
  providers: [OrgResolver, OrgService],
  exports: [OrgService],
})
export class OrgModule {}
