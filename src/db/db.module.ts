import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

const connection =
  process.env.NODE_ENV === 'test'
    ? 'mongodb+srv://hepius-user:ZWHTgx27kNlcGybK@cluster0.bvvib.mongodb.net/iris-test'
    : 'mongodb+srv://hepius-user:ZWHTgx27kNlcGybK@cluster0.bvvib.mongodb.net/iris-localhost';

console.log({ connection });
// console.log(process.env.NODE_ENV);
// const dbLocal =
//   'mongodb+srv://hepius-user:ZWHTgx27kNlcGybK@cluster0.bvvib.mongodb.net/iris-localhost';
// const dbTest = 'mongodb+srv://hepius-user:ZWHTgx27kNlcGybK@cluster0.bvvib.mongodb.net/iris-test';

@Module({
  imports: [MongooseModule.forRoot(connection)],
})
export class DbModule {}
