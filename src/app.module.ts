import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { GraphQLModule } from '@nestjs/graphql';
import { ScheduleModule } from '@nestjs/schedule';
import { TerminusModule } from '@nestjs/terminus';
import { GraphQLError } from 'graphql';
import { AppointmentModule } from './appointment';
import { AvailabilityModule } from './availability';
import { CommonModule, Errors } from './common';
import { CommunicationModule } from './communication';
import { DbModule } from './db/db.module';
import { HealthController } from './health/health.controller';
import { MemberModule } from './member';
import { OrgModule } from './org';
import { ProvidersModule } from './providers';
import { UserModule } from './user';

const badRequestException = 'Bad Request Exception';

@Module({
  imports: [
    MemberModule,
    UserModule,
    AppointmentModule,
    OrgModule,
    AvailabilityModule,
    CommunicationModule,
    CommonModule,
    ProvidersModule,
    DbModule,
    TerminusModule,
    EventEmitterModule.forRoot(),
    ScheduleModule.forRoot(),
    GraphQLModule.forRoot({
      autoSchemaFile: 'schema.gql',
      cors: true,
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
