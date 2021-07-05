import { Module } from '@nestjs/common';
import { MemberService } from './member.service';
import { MemberResolver } from './member.resolver';
import { MongooseModule } from '@nestjs/mongoose';
import { Member, MemberDto } from './member.dto';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Member.name, schema: MemberDto }]),
  ],
  providers: [MemberResolver, MemberService],
})
export class MemberModule {}
