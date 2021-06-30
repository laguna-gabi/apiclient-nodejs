import { Module } from '@nestjs/common';
import { DbModule } from './db/db.module';
import { MemberModule } from './member/member.module';
import { GraphQLModule } from '@nestjs/graphql';
import { UserModule } from './user/user.module';

@Module({
  imports: [
    MemberModule,
    UserModule,
    DbModule,
    GraphQLModule.forRoot({ autoSchemaFile: 'schema.gql' }),
  ],
})
export class AppModule {}
