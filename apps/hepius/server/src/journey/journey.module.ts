import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  ActionItem,
  ActionItemDto,
  Admission,
  AdmissionDto,
  AdmissionService,
  CaregiverDto,
  CaregiverResolver,
  CaregiverService,
  ControlJourney,
  ControlJourneyDto,
  Diagnosis,
  DiagnosisDto,
  Dietary,
  DietaryDto,
  DietaryHelper,
  ExternalAppointment,
  ExternalAppointmentDto,
  Journal,
  JournalDto,
  Journey,
  JourneyDto,
  JourneyResolver,
  JourneyService,
  JourneyTcpController,
  Medication,
  MedicationDto,
  TreatmentRendered,
  TreatmentRenderedDto,
} from '.';
import { CommonModule, DismissedAlert, DismissedAlertDto, LoggerService } from '../common';
import { ProvidersModule } from '../providers';
import { Caregiver } from '@argus/hepiusClient';
import { ChangeEventFactoryProvider } from '../db';
import { EntityName } from '@argus/pandora';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Module({
  imports: [
    CommonModule,
    ProvidersModule,
    MongooseModule.forFeature([
      { name: Journey.name, schema: JourneyDto },
      { name: ControlJourney.name, schema: ControlJourneyDto },
      { name: Diagnosis.name, schema: DiagnosisDto },
      { name: TreatmentRendered.name, schema: TreatmentRenderedDto },
      { name: Medication.name, schema: MedicationDto },
      { name: ExternalAppointment.name, schema: ExternalAppointmentDto },
      { name: Dietary.name, schema: DietaryDto },
      { name: Admission.name, schema: AdmissionDto },
      { name: ActionItem.name, schema: ActionItemDto },
      { name: Journal.name, schema: JournalDto },
      { name: DismissedAlert.name, schema: DismissedAlertDto },
    ]),
    MongooseModule.forFeatureAsync([
      {
        name: Caregiver.name,
        imports: [CommonModule],
        useFactory: ChangeEventFactoryProvider(EntityName.caregiver, CaregiverDto, 'memberId'),
        inject: [EventEmitter2, LoggerService],
      },
    ]),
  ],
  providers: [
    JourneyResolver,
    JourneyService,
    CaregiverService,
    CaregiverResolver,
    AdmissionService,
    DietaryHelper,
  ],
  controllers: [JourneyTcpController],
  exports: [JourneyService, CaregiverResolver, MongooseModule],
})
export class JourneyModule {}
