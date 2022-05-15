import { Transcript, TranscriptDto } from '@argus/poseidonClient';
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TranscriptCalculator, TranscriptController, TranscriptService } from '.';
import { CommonModule } from '../common';
import { ProvidersModule } from '../providers';

@Module({
  imports: [
    CommonModule,
    ProvidersModule,
    MongooseModule.forFeature([{ name: Transcript.name, schema: TranscriptDto }]),
  ],
  providers: [TranscriptCalculator, TranscriptService],
  exports: [],
  controllers: [TranscriptController],
})
export class TranscriptModule {}
