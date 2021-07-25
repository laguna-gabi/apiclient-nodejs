import { Module } from '@nestjs/common';
import {
  ActionItem,
  ActionItemDto,
  Goal,
  GoalDto,
  Member,
  MemberDto,
  MemberResolver,
  MemberService,
} from '.';
import { MongooseModule } from '@nestjs/mongoose';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Member.name, schema: MemberDto },
      { name: Goal.name, schema: GoalDto },
      { name: ActionItem.name, schema: ActionItemDto },
    ]),
  ],
  providers: [MemberResolver, MemberService],
})
export class MemberModule {}
