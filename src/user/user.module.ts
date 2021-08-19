import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserDto, UserResolver, UserService, SlotService } from '.';

@Module({
  imports: [MongooseModule.forFeature([{ name: User.name, schema: UserDto }])],
  providers: [UserResolver, UserService, SlotService],
})
export class UserModule {}
