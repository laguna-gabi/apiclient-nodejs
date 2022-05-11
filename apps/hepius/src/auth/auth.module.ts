import { User } from '@argus/hepiusClient';
import { Module, forwardRef } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { AuthService, CustomStrategy, UserSecurityService } from '.';
import { MongooseModule } from '@nestjs/mongoose';
import { UserDto } from '../user';
import { Member, MemberDto } from '../member';

@Module({
  imports: [
    forwardRef(() =>
      MongooseModule.forFeature([
        { name: User.name, schema: UserDto },
        { name: Member.name, schema: MemberDto },
      ]),
    ),
    PassportModule,
  ],
  providers: [AuthService, CustomStrategy, UserSecurityService],
  exports: [UserSecurityService],
})
export class AuthModule {}
