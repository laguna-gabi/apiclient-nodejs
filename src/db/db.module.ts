import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { db } from 'config';

@Module({
  imports: [MongooseModule.forRoot(db.connection)],
})
export class DbModule {}
