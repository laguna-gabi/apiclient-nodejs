import { Transcript, TranscriptDto } from '@argus/poseidonClient';
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TranscriptCalculator, TranscriptService } from '.';
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
})
export class TranscriptModule {}
