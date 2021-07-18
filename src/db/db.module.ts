import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import * as config from 'config';

@Module({
  imports: [
    MongooseModule.forRoot(config.get('db.connection'), {
      useFindAndModify: false,
    }),
  ],
})
export class DbModule {}
