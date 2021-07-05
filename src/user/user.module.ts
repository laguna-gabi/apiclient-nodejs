import { Module } from '@nestjs/common';
import { UserService } from './user.service';
import { UserResolver } from './user.resolver';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserDto } from './user.dto';

@Module({
  imports: [MongooseModule.forFeature([{ name: User.name, schema: UserDto }])],
  providers: [UserResolver, UserService],
})
export class UserModule {}
