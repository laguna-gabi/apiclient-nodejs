import { forwardRef, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Member, MemberDto } from '../member';
import { User, UserDto } from '../user';
import { UserSecurityService } from './auth.security.service';

@Module({
  imports: [
    forwardRef(() => MongooseModule.forFeature([{ name: User.name, schema: UserDto }])),
    forwardRef(() => MongooseModule.forFeature([{ name: Member.name, schema: MemberDto }])),
  ],
  providers: [UserSecurityService],
  exports: [UserSecurityService],
})
export class UserSecurityModule {}
