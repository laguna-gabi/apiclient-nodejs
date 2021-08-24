import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserDto, UserResolver, UserController, UserService, SlotService } from '.';

@Module({
  imports: [MongooseModule.forFeature([{ name: User.name, schema: UserDto }])],
  providers: [UserResolver, UserService, SlotService],
  controllers: [UserController],
})
export class UserModule {}
