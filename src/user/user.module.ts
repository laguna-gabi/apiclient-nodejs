import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UserService, UserResolver, User, UserDto } from '.';

@Module({
  imports: [MongooseModule.forFeature([{ name: User.name, schema: UserDto }])],
  providers: [UserResolver, UserService],
})
export class UserModule {}
