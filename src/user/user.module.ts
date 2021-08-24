import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  User,
  UserDto,
  UserResolver,
  UserService,
  SlotService,
  UserConfig,
  UserConfigDto,
  UserController,
} from '.';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserDto },
      { name: UserConfig.name, schema: UserConfigDto },
    ]),
  ],
  providers: [UserResolver, UserService, SlotService],
  controllers: [UserController],
})
export class UserModule {}
