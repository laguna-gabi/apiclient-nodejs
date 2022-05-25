import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  ActionItem,
  ActionItemDto,
  Admission,
  AdmissionDto,
  AdmissionService,
  Diagnosis,
  DiagnosisDto,
  Dietary,
  DietaryDto,
  DietaryHelper,
  ExternalAppointment,
  ExternalAppointmentDto,
  Journey,
  JourneyDto,
  JourneyResolver,
  JourneyService,
  Medication,
  MedicationDto,
  TreatmentRendered,
  TreatmentRenderedDto,
} from '.';
import { CommonModule, DismissedAlert, DismissedAlertDto } from '../common';
import { ProvidersModule } from '../providers';

@Module({
  imports: [
    CommonModule,
    ProvidersModule,
    MongooseModule.forFeature([
      { name: Journey.name, schema: JourneyDto },
      { name: Diagnosis.name, schema: DiagnosisDto },
      { name: TreatmentRendered.name, schema: TreatmentRenderedDto },
      { name: Medication.name, schema: MedicationDto },
      { name: ExternalAppointment.name, schema: ExternalAppointmentDto },
      { name: Dietary.name, schema: DietaryDto },
      { name: Admission.name, schema: AdmissionDto },
      { name: ActionItem.name, schema: ActionItemDto },
      { name: DismissedAlert.name, schema: DismissedAlertDto },
    ]),
  ],
  providers: [JourneyResolver, JourneyService, AdmissionService, DietaryHelper],
  exports: [JourneyService, MongooseModule],
})
export class JourneyModule {}
