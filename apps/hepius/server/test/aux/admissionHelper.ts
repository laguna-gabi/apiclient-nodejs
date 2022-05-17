import { Model, model } from 'mongoose';
import {
  Admission,
  AdmissionCategory,
  AdmissionDocument,
  AdmissionDto,
  Diagnosis,
  DiagnosisDocument,
  DiagnosisDto,
  Dietary,
  DietaryDocument,
  DietaryDto,
  ExternalAppointment,
  ExternalAppointmentDocument,
  ExternalAppointmentDto,
  Medication,
  MedicationDocument,
  MedicationDto,
  TreatmentRendered,
  TreatmentRenderedDocument,
  TreatmentRenderedDto,
} from '../../src/member';
import { ErrorType, defaultTimestampsDbValues } from '../../src/common';
import {
  generateAdmissionDiagnosisParams,
  generateAdmissionDietaryParams,
  generateAdmissionExternalAppointmentParams,
  generateAdmissionMedicationParams,
  generateAdmissionTreatmentRenderedParams,
} from '../generators';

export class AdmissionHelper {
  private diagnosisModel: Model<DiagnosisDocument & defaultTimestampsDbValues>;
  private treatmentRenderedModel: Model<TreatmentRenderedDocument & defaultTimestampsDbValues>;
  private medicationModel: Model<MedicationDocument & defaultTimestampsDbValues>;
  private externalAppointmentModel: Model<ExternalAppointmentDocument & defaultTimestampsDbValues>;
  private dietaryModel: Model<DietaryDocument & defaultTimestampsDbValues>;
  admissionModel: Model<AdmissionDocument & defaultTimestampsDbValues>;

  mapper: Map<
    AdmissionCategory,
    { field: string; method; model?: typeof Model; errorNotFound?: ErrorType }
  > = new Map();

  constructor() {
    this.initModels();
    this.initMaps();
  }

  getSubModels() {
    return [
      this.diagnosisModel,
      this.treatmentRenderedModel,
      this.medicationModel,
      this.externalAppointmentModel,
      this.dietaryModel,
    ];
  }

  private initModels = () => {
    this.admissionModel = model<AdmissionDocument & defaultTimestampsDbValues>(
      Admission.name,
      AdmissionDto,
    );
    this.diagnosisModel = model<DiagnosisDocument & defaultTimestampsDbValues>(
      Diagnosis.name,
      DiagnosisDto,
    );
    this.treatmentRenderedModel = model<TreatmentRenderedDocument & defaultTimestampsDbValues>(
      TreatmentRendered.name,
      TreatmentRenderedDto,
    );
    this.medicationModel = model<MedicationDocument & defaultTimestampsDbValues>(
      Medication.name,
      MedicationDto,
    );
    this.externalAppointmentModel = model<ExternalAppointmentDocument & defaultTimestampsDbValues>(
      ExternalAppointment.name,
      ExternalAppointmentDto,
    );
    this.dietaryModel = model<DietaryDocument & defaultTimestampsDbValues>(
      Dietary.name,
      DietaryDto,
    );
  };

  private initMaps = () => {
    this.mapper.set(AdmissionCategory.diagnoses, {
      field: 'diagnosis',
      method: generateAdmissionDiagnosisParams,
      model: this.diagnosisModel,
      errorNotFound: ErrorType.admissionDiagnosisIdNotFound,
    });
    this.mapper.set(AdmissionCategory.treatmentRendereds, {
      field: 'treatmentRendered',
      method: generateAdmissionTreatmentRenderedParams,
      model: this.treatmentRenderedModel,
      errorNotFound: ErrorType.admissionTreatmentRenderedIdNotFound,
    });
    this.mapper.set(AdmissionCategory.medications, {
      field: 'medication',
      method: generateAdmissionMedicationParams,
      model: this.medicationModel,
      errorNotFound: ErrorType.admissionMedicationIdNotFound,
    });
    this.mapper.set(AdmissionCategory.externalAppointments, {
      field: 'externalAppointment',
      method: generateAdmissionExternalAppointmentParams,
      model: this.externalAppointmentModel,
      errorNotFound: ErrorType.admissionExternalAppointmentIdNotFound,
    });
    this.mapper.set(AdmissionCategory.dietaries, {
      field: 'dietary',
      method: generateAdmissionDietaryParams,
      model: this.dietaryModel,
      errorNotFound: ErrorType.admissionDietaryIdNotFound,
    });
  };
}
