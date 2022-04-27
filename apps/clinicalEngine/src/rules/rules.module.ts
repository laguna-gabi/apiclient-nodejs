import { Module } from '@nestjs/common';
import { RulesService } from './rules.service';
import { CommonModule } from '../common';

@Module({
  imports: [CommonModule],
  providers: [RulesService],
  exports: [RulesService],
})
export class RulesModule {}
