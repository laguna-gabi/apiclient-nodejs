import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DbModule } from './db/db.module';
import { MemberModule } from './member/member.module';
import { GraphQLModule } from '@nestjs/graphql';
import { CoachModule } from './coach/coach.module';

@Module({
  imports: [
    MemberModule,
    CoachModule,
    DbModule,
    GraphQLModule.forRoot({ autoSchemaFile: 'schema.gql' }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
