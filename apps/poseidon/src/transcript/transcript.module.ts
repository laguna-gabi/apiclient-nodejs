import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Transcript, TranscriptDto, TranscriptService } from '.';

@Module({
  imports: [MongooseModule.forFeature([{ name: Transcript.name, schema: TranscriptDto }])],
  providers: [TranscriptService],
  exports: [],
})
export class TranscriptModule {}
