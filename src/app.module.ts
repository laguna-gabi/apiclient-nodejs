import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { RouteInfo } from '@nestjs/common/interfaces';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { GraphQLModule } from '@nestjs/graphql';
import { TerminusModule } from '@nestjs/terminus';
import * as config from 'config';
import { GraphQLError } from 'graphql';
import { AppointmentModule } from './appointment';
import { AuthModule, AuthService } from './auth';
import { AvailabilityModule } from './availability';
import { Errors, JsonBodyMiddleware, RawBodyMiddleware } from './common';
import { CommunicationModule } from './communication';
import { DailyReportModule } from './dailyReport';
import { DbModule } from './db';
import { HealthController } from './health/health.controller';
import { MemberModule } from './member';
import { OrgModule } from './org';
import { ProvidersModule } from './providers';
import { ServiceModule } from './services';
import { TodoModule } from './todo';
import { UserModule } from './user';
import { CareModule } from './care';
import { QuestionnaireModule } from './questionnaire';

const badRequestException = 'Bad Request Exception';

@Module({
  imports: [
    AuthModule,
    MemberModule,
    CommunicationModule,
    UserModule,
    AppointmentModule,
    OrgModule,
    AvailabilityModule,
    DailyReportModule,
    TodoModule,
    ProvidersModule,
    ServiceModule,
    DbModule,
    TerminusModule,
    CareModule,
    QuestionnaireModule,
    EventEmitterModule.forRoot(),
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
export class AppModule implements NestModule {
  public configure(consumer: MiddlewareConsumer): void {
    const skipBodyParseRouteList: RouteInfo[] = [];

    config.get('skipBodyParseRouteList').forEach((routeListEntry) => {
      skipBodyParseRouteList.push({ path: routeListEntry.path, method: routeListEntry.method });
    });

    consumer
      .apply(RawBodyMiddleware)
      .forRoutes(...skipBodyParseRouteList)
      .apply(JsonBodyMiddleware)
      .forRoutes('*');
  }
}
