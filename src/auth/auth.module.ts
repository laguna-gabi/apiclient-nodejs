import { Module, forwardRef } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { AuthService, CustomStrategy, UserSecurityService } from '.';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserDto } from '../user';
import { Member, MemberDto } from '../member';
import * as mongooseDelete from 'mongoose-delete';
import { useFactoryOptions } from '../db';

@Module({
  imports: [
    forwardRef(() => MongooseModule.forFeature([{ name: User.name, schema: UserDto }])),
    forwardRef(() =>
      MongooseModule.forFeatureAsync([
        {
          name: Member.name,
          useFactory: () => {
            return MemberDto.plugin(mongooseDelete, useFactoryOptions);
          },
        },
      ]),
    ),
    PassportModule,
  ],
  providers: [AuthService, CustomStrategy, UserSecurityService],
  exports: [UserSecurityService],
})
export class AuthModule {}
