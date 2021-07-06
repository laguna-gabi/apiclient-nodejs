import { Module } from '@nestjs/common';
import { MemberService, MemberResolver, Member, MemberDto } from '.';
import { MongooseModule } from '@nestjs/mongoose';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Member.name, schema: MemberDto }]),
  ],
  providers: [MemberResolver, MemberService],
})
export class MemberModule {}
