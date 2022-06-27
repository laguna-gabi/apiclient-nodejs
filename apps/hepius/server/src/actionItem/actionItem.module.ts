import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  ActionItem,
  ActionItemDto,
  ActionItemResolver,
  ActionItemService,
  AutoActionItem,
} from '.';
import { CommonModule, DismissedAlert, DismissedAlertDto } from '../common';
import { JourneyModule } from '../journey';
import { ProvidersModule } from '../providers';
import { QuestionnaireModule } from '../questionnaire';

@Module({
  imports: [
    CommonModule,
    ProvidersModule,
    QuestionnaireModule,
    JourneyModule,
    MongooseModule.forFeature([
      { name: ActionItem.name, schema: ActionItemDto },
      { name: DismissedAlert.name, schema: DismissedAlertDto },
    ]),
  ],
  providers: [ActionItemResolver, ActionItemService, AutoActionItem],
  exports: [ActionItemService],
})
export class ActionItemModule {}
