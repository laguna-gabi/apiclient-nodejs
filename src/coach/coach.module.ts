import { Module } from '@nestjs/common';
import { CoachService } from './coach.service';
import { CoachResolver } from './coach.resolver';
import { MongooseModule } from '@nestjs/mongoose';
import { Coach, CoachSchema } from './coach.dto';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Coach.name, schema: CoachSchema }]),
  ],
  providers: [CoachResolver, CoachService],
})
export class CoachModule {}
