import { Module } from '@nestjs/common';
import { Member, MemberDto, MemberResolver, MemberService } from '.';
import { MongooseModule } from '@nestjs/mongoose';

@Module({
  imports: [MongooseModule.forFeature([{ name: Member.name, schema: MemberDto }])],
  providers: [MemberResolver, MemberService],
})
export class MemberModule {}
