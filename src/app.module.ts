import { Module } from '@nestjs/common';
import { DbModule } from './db/db.module';
import { MemberModule } from './member';
import { GraphQLModule } from '@nestjs/graphql';
import { UserModule } from './user';
import { AppointmentModule } from './appointment';
import { GraphQLError } from 'graphql';
import { Errors } from './common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { OrgModule } from './org';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './health/health.controller';
import { AvailabilityModule } from './availability';

const badRequestException = 'Bad Request Exception';

@Module({
  imports: [
    MemberModule,
    UserModule,
    AppointmentModule,
    OrgModule,
    AvailabilityModule,
    DbModule,
    TerminusModule,
    EventEmitterModule.forRoot(),
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
          : error?.extensions.exception.response?.message.map((error) => handleErrorMessage(error));
      },
    }),
  ],
  controllers: [HealthController],
})
export class AppModule {}
