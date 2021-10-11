import { Module } from '@nestjs/common';
import { DbModule } from './db/db.module';
import { MemberModule } from './member';
import { GraphQLModule } from '@nestjs/graphql';
import { UserModule } from './user';
import { AppointmentModule } from './appointment';
import { GraphQLError } from 'graphql';
import { Errors, CommonModule } from './common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { OrgModule } from './org';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './health/health.controller';
import { AvailabilityModule } from './availability';
import { CommunicationModule } from './communication';
import { ProvidersModule } from './providers';
import { ScheduleModule } from '@nestjs/schedule';

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
