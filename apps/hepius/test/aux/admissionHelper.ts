import { Model, model } from 'mongoose';
import {
  Activity,
  ActivityDocument,
  ActivityDto,
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
  Procedure,
  ProcedureDocument,
  ProcedureDto,
  WoundCare,
  WoundCareDocument,
  WoundCareDto,
} from '../../src/member';
import { ErrorType, defaultTimestampsDbValues } from '../../src/common';
import {
  generateAdmissionActivityParams,
  generateAdmissionDiagnosisParams,
  generateAdmissionDietaryParams,
  generateAdmissionExternalAppointmentParams,
  generateAdmissionMedicationParams,
  generateAdmissionProcedureParams,
  generateAdmissionWoundCareParams,
} from '../generators';

export class AdmissionHelper {
  private diagnosisModel: Model<DiagnosisDocument & defaultTimestampsDbValues>;
  private procedureModel: Model<ProcedureDocument & defaultTimestampsDbValues>;
  private medicationModel: Model<MedicationDocument & defaultTimestampsDbValues>;
  private externalAppointmentModel: Model<ExternalAppointmentDocument & defaultTimestampsDbValues>;
  private activityModel: Model<ActivityDocument & defaultTimestampsDbValues>;
  private woundCareModel: Model<WoundCareDocument & defaultTimestampsDbValues>;
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
      this.procedureModel,
      this.medicationModel,
      this.externalAppointmentModel,
      this.activityModel,
      this.woundCareModel,
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
    this.procedureModel = model<ProcedureDocument & defaultTimestampsDbValues>(
      Procedure.name,
      ProcedureDto,
    );
    this.medicationModel = model<MedicationDocument & defaultTimestampsDbValues>(
      Medication.name,
      MedicationDto,
    );
    this.externalAppointmentModel = model<ExternalAppointmentDocument & defaultTimestampsDbValues>(
      ExternalAppointment.name,
      ExternalAppointmentDto,
    );
    this.activityModel = model<ActivityDocument & defaultTimestampsDbValues>(
      Activity.name,
      ActivityDto,
    );
    this.woundCareModel = model<WoundCareDocument & defaultTimestampsDbValues>(
      WoundCare.name,
      WoundCareDto,
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
    this.mapper.set(AdmissionCategory.procedures, {
      field: 'procedure',
      method: generateAdmissionProcedureParams,
      model: this.procedureModel,
      errorNotFound: ErrorType.admissionProcedureIdNotFound,
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
    this.mapper.set(AdmissionCategory.activities, {
      field: 'activity',
      method: generateAdmissionActivityParams,
      model: this.activityModel,
      errorNotFound: ErrorType.admissionActivityIdNotFound,
    });
    this.mapper.set(AdmissionCategory.woundCares, {
      field: 'woundCare',
      method: generateAdmissionWoundCareParams,
      model: this.woundCareModel,
      errorNotFound: ErrorType.admissionWoundCareIdNotFound,
    });
    this.mapper.set(AdmissionCategory.dietaries, {
      field: 'dietary',
      method: generateAdmissionDietaryParams,
      model: this.dietaryModel,
      errorNotFound: ErrorType.admissionDietaryIdNotFound,
    });
  };
}
