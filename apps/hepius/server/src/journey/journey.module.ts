import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
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
import { CommonModule } from '../common';

@Module({
  imports: [
    CommonModule,
    MongooseModule.forFeature([
      { name: Journey.name, schema: JourneyDto },
      { name: Diagnosis.name, schema: DiagnosisDto },
      { name: TreatmentRendered.name, schema: TreatmentRenderedDto },
      { name: Medication.name, schema: MedicationDto },
      { name: ExternalAppointment.name, schema: ExternalAppointmentDto },
      { name: Dietary.name, schema: DietaryDto },
      { name: Admission.name, schema: AdmissionDto },
    ]),
  ],
  providers: [JourneyResolver, JourneyService, AdmissionService, DietaryHelper],
  exports: [JourneyService, MongooseModule],
})
export class JourneyModule {}
