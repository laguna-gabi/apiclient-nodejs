import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ProvidersModule } from '../providers';
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
import { CommonModule } from '../common';

@Module({
  imports: [
    ProvidersModule,
    CommonModule,
    MongooseModule.forFeature([
      { name: User.name, schema: UserDto },
      { name: UserConfig.name, schema: UserConfigDto },
    ]),
  ],
  providers: [UserResolver, UserService, SlotService],
  controllers: [UserController],
  exports: [UserService],
})
export class UserModule {}
