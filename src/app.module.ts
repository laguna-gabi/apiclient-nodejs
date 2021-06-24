import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { MemberModule } from './modules/member/member.module';
import { DbModule } from './modules/db/db.module';

@Module({
  imports: [MemberModule, DbModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
