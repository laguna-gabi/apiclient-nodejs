import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { GraphQLModule } from '@nestjs/graphql';
import { ScheduleModule } from '@nestjs/schedule';
import { TerminusModule } from '@nestjs/terminus';
import { GraphQLError } from 'graphql';
import { AppointmentModule } from './appointment';
import { AuthModule } from './auth/auth.module';
import { UserSecurityModule } from './auth/auth.security.module';
import { AuthService } from './auth/auth.service';
import { AvailabilityModule } from './availability';
import { Errors } from './common';
import { CommunicationModule } from './communication';
import { DailyReportModule } from './dailyReport/dailyReport.module';
import { DbModule } from './db/db.module';
import { HealthController } from './health/health.controller';
import { MemberModule } from './member';
import { OrgModule } from './org';
import { ProvidersModule } from './providers';
import { UserModule } from './user';

const badRequestException = 'Bad Request Exception';

@Module({
  imports: [
    AuthModule,
    UserSecurityModule,
    MemberModule,
    CommunicationModule,
    UserModule,
    AppointmentModule,
    OrgModule,
    AvailabilityModule,
    DailyReportModule,
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
  providers: [AuthService],
})
export class AppModule {}
