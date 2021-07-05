import { Module } from '@nestjs/common';
import { DbModule } from './db/db.module';
import { MemberModule } from './member/member.module';
import { GraphQLModule } from '@nestjs/graphql';
import { UserModule } from './user/user.module';
import { GraphQLError, GraphQLFormattedError } from 'graphql';

@Module({
  imports: [
    MemberModule,
    UserModule,
    DbModule,
    GraphQLModule.forRoot({
      autoSchemaFile: 'schema.gql',
      formatError: (error: GraphQLError) => {
        const graphQLFormattedError: GraphQLFormattedError = {
          message:
            error?.message && error?.message !== 'Bad Request Exception'
              ? error?.message
              : error?.extensions.exception.response?.message,
        };
        return graphQLFormattedError;
      },
    }),
  ],
})
export class AppModule {}
