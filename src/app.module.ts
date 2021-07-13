import { Module } from '@nestjs/common';
import { DbModule } from './db/db.module';
import { MemberModule } from './member';
import { GraphQLModule } from '@nestjs/graphql';
import { UserModule } from './user';
import { AppointmentModule } from './appointment';
import { GraphQLError } from 'graphql';
import { Errors } from './common';

const badRequestException = 'Bad Request Exception';

@Module({
  imports: [
    MemberModule,
    UserModule,
    AppointmentModule,
    DbModule,
    GraphQLModule.forRoot({
      autoSchemaFile: 'schema.gql',
      formatError: (error: GraphQLError) => {
        const handleErrorMessage = (message: string) => {
          for (const key of Errors.keys()) {
            if (Errors.get(key) === message) {
              return { code: key, message };
            }
          }
          return { code: -1, message };
        };

        return error?.message && error?.message !== badRequestException
          ? handleErrorMessage(error?.message)
          : error?.extensions.exception.response?.message.map((error) =>
              handleErrorMessage(error),
            );
      },
    }),
  ],
})
export class AppModule {}
