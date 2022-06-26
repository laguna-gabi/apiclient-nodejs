import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ActionItem, ActionItemDto, ActionItemResolver, ActionItemService } from '.';
import { CommonModule, DismissedAlert, DismissedAlertDto } from '../common';
import { JourneyModule } from '../journey';
import { ProvidersModule } from '../providers';

@Module({
  imports: [
    CommonModule,
    ProvidersModule,
    JourneyModule,
    MongooseModule.forFeature([
      { name: ActionItem.name, schema: ActionItemDto },
      { name: DismissedAlert.name, schema: DismissedAlertDto },
    ]),
  ],
  providers: [ActionItemResolver, ActionItemService],
  exports: [ActionItemService],
})
export class ActionItemModule {}
