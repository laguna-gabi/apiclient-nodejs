import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  SlotService,
  User,
  UserConfig,
  UserConfigDto,
  UserController,
  UserDto,
  UserResolver,
  UserService,
} from '.';
import { CommonModule } from '../common';
import { ProvidersModule } from '../providers';

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
  exports: [UserService, MongooseModule],
})
export class UserModule {}
