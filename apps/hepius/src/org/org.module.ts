import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Org, OrgController, OrgDto, OrgResolver, OrgService } from '.';
import { CommonModule } from '../common';

@Module({
  imports: [CommonModule, MongooseModule.forFeature([{ name: Org.name, schema: OrgDto }])],
  providers: [OrgResolver, OrgService],
  exports: [OrgService],
  controllers: [OrgController],
})
export class OrgModule {}
