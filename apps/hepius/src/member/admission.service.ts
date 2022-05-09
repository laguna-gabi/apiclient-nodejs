import {
  Activity,
  ActivityDocument,
  Admission,
  AdmissionCategory,
  AdmissionDocument,
  BaseCategory,
  ChangeAdmissionActivityParams,
  ChangeAdmissionDiagnosisParams,
  ChangeAdmissionExternalAppointmentParams,
  ChangeAdmissionMedicationParams,
  ChangeAdmissionProcedureParams,
  ChangeAdmissionWoundCareParams,
  ChangeMemberDnaParams,
  Diagnosis,
  DiagnosisDocument,
  Dietary,
  DietaryDocument,
  ExternalAppointment,
  ExternalAppointmentDocument,
  Medication,
  MedicationDocument,
  Procedure,
  ProcedureDocument,
  WoundCare,
  WoundCareDocument,
} from '.';
import { BaseService, ChangeType, ErrorType, Errors, LoggerService } from '../common';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ISoftDelete } from '../db';
import { cloneDeep, isNil, omitBy } from 'lodash';

class InternalValue {
  model: typeof Model;
  errorType: ErrorType;
}

@Injectable()
export class AdmissionService extends BaseService {
  private readonly matchMap: Map<AdmissionCategory, InternalValue> = new Map();

  constructor(
    @InjectModel(Diagnosis.name)
    private readonly diagnosisModel: Model<DiagnosisDocument> & ISoftDelete<DiagnosisDocument>,
    @InjectModel(Procedure.name)
    private readonly procedureModel: Model<ProcedureDocument> & ISoftDelete<ProcedureDocument>,
    @InjectModel(Medication.name)
    private readonly medicationModel: Model<MedicationDocument> & ISoftDelete<MedicationDocument>,
    @InjectModel(Admission.name)
    private readonly admissionModel: Model<AdmissionDocument> & ISoftDelete<AdmissionDocument>,
    @InjectModel(ExternalAppointment.name)
    private readonly externalAppointmentModel: Model<ExternalAppointmentDocument> &
      ISoftDelete<ExternalAppointmentDocument>,
    @InjectModel(Activity.name)
    private readonly activityModel: Model<ActivityDocument> & ISoftDelete<ActivityDocument>,
    @InjectModel(WoundCare.name)
    private readonly woundCareModel: Model<WoundCareDocument> & ISoftDelete<WoundCareDocument>,
    @InjectModel(Dietary.name)
    private readonly dietaryModel: Model<DietaryDocument> & ISoftDelete<DietaryDocument>,
    readonly logger: LoggerService,
  ) {
    super();
    this.matchMap[AdmissionCategory.diagnoses] = {
      model: this.diagnosisModel,
      errorType: ErrorType.admissionDiagnosisIdNotFound,
    };
    this.matchMap[AdmissionCategory.procedures] = {
      model: this.procedureModel,
      errorType: ErrorType.admissionProcedureIdNotFound,
    };
    this.matchMap[AdmissionCategory.medications] = {
      model: this.medicationModel,
      errorType: ErrorType.admissionMedicationIdNotFound,
    };
    this.matchMap[AdmissionCategory.externalAppointments] = {
      model: this.externalAppointmentModel,
      errorType: ErrorType.admissionExternalAppointmentIdNotFound,
    };
    this.matchMap[AdmissionCategory.activities] = {
      model: this.activityModel,
      errorType: ErrorType.admissionActivityIdNotFound,
    };
    this.matchMap[AdmissionCategory.woundCares] = {
      model: this.woundCareModel,
      errorType: ErrorType.admissionWoundCareIdNotFound,
    };
    this.matchMap[AdmissionCategory.dietaries] = {
      model: this.dietaryModel,
      errorType: ErrorType.admissionDietaryIdNotFound,
    };
  }

  async get(memberId: string): Promise<Admission[]> {
    const result = await this.admissionModel.find({ memberId: new Types.ObjectId(memberId) });
    return Promise.all(
      result.map(async (item) => {
        const populateAllRes = await this.populateAll(item);
        return this.replaceId(this.replaceSubIds(populateAllRes));
      }),
    );
  }

  async change(changeMemberDnaParams: ChangeMemberDnaParams): Promise<Admission> {
    const setParams: ChangeMemberDnaParams = omitBy(changeMemberDnaParams, isNil);
    const { memberId } = changeMemberDnaParams;
    let { id } = changeMemberDnaParams;
    if (!Object.keys(setParams).some((key) => key !== 'memberId' && key !== 'id')) {
      throw new Error(Errors.get(ErrorType.admissionDataNotProvidedOnChangeDna));
    }

    let result;
    if (setParams.diagnosis) {
      const { changeType, ...diagnoses }: ChangeAdmissionDiagnosisParams = setParams.diagnosis;
      const admissionCategory = AdmissionCategory.diagnoses;
      result = await this.changeInternal(diagnoses, changeType, admissionCategory, memberId, id);
      id = result._id.toString();
    }
    if (setParams.procedure) {
      const { changeType, ...procedure }: ChangeAdmissionProcedureParams = setParams.procedure;
      const admissionCategory = AdmissionCategory.procedures;
      result = await this.changeInternal(procedure, changeType, admissionCategory, memberId, id);
      id = result._id.toString();
    }
    if (setParams.medication) {
      const { changeType, ...medication }: ChangeAdmissionMedicationParams = setParams.medication;
      const admissionCategory = AdmissionCategory.medications;
      result = await this.changeInternal(medication, changeType, admissionCategory, memberId, id);
      id = result._id.toString();
    }
    if (setParams.externalAppointment) {
      const { changeType, ...externalAppointment }: ChangeAdmissionExternalAppointmentParams =
        setParams.externalAppointment;
      const admissionCategory = AdmissionCategory.externalAppointments;
      result = await this.changeInternal(
        externalAppointment,
        changeType,
        admissionCategory,
        memberId,
        id,
      );
      id = result._id.toString();
    }
    if (setParams.activity) {
      const { changeType, ...activity }: ChangeAdmissionActivityParams = setParams.activity;
      const admissionCategory = AdmissionCategory.activities;
      result = await this.changeInternal(activity, changeType, admissionCategory, memberId, id);
      id = result._id.toString();
    }
    if (setParams.woundCare) {
      const { changeType, ...woundCare }: ChangeAdmissionWoundCareParams = setParams.woundCare;
      const admissionCategory = AdmissionCategory.woundCares;
      result = await this.changeInternal(woundCare, changeType, admissionCategory, memberId, id);
      id = result._id.toString();
    }
    if (setParams.dietary) {
      const { changeType, ...dietary }: ChangeAdmissionWoundCareParams = setParams.dietary;
      const admissionCategory = AdmissionCategory.dietaries;
      result = await this.changeInternal(dietary, changeType, admissionCategory, memberId, id);
    }

    return this.replaceId(this.replaceSubIds(result));
  }

  /*************************************************************************************************
   ******************************************** Helpers ********************************************
   ************************************************************************************************/
  private async changeInternal(
    element: BaseCategory,
    changeType: ChangeType,
    admissionCategory: AdmissionCategory,
    memberId: string,
    id: string,
  ): Promise<Admission> {
    switch (changeType) {
      case ChangeType.create:
        return this.createRefObjects(element, admissionCategory, memberId, id);
      case ChangeType.update:
        return this.updateRefObjects(element, admissionCategory);
      case ChangeType.delete:
        return this.deleteRefObjects(element.id, admissionCategory);
    }
  }

  private async createRefObjects(
    element: BaseCategory,
    admissionCategory: AdmissionCategory,
    memberId: string,
    id?: string,
  ): Promise<Admission> {
    const internalValue: InternalValue = this.matchMap[admissionCategory];
    const { _id } = await internalValue.model.create(omitBy(element, isNil));
    if (id) {
      const result = await this.admissionModel.findByIdAndUpdate(
        new Types.ObjectId(id),
        { $addToSet: { [`${admissionCategory}`]: _id } },
        { upsert: false, new: true },
      );
      return this.populateAll(result);
    } else {
      const result = await this.admissionModel.create({
        memberId: new Types.ObjectId(memberId),
        [`${admissionCategory}`]: _id,
      });
      return this.populateAll(result);
    }
  }

  private async updateRefObjects(
    element: BaseCategory,
    admissionCategory: AdmissionCategory,
  ): Promise<Admission> {
    const internalValue: InternalValue = this.matchMap[admissionCategory];
    const objectId = new Types.ObjectId(element.id);
    const result = await internalValue.model.findByIdAndUpdate(objectId, {
      $set: { ...omitBy(element, isNil) },
    });
    if (!result) {
      throw new Error(Errors.get(internalValue.errorType));
    }
    const admission = await this.admissionModel.findOne({ [`${admissionCategory}`]: objectId });
    const object = await this.admissionModel.findById(admission._id);
    return this.populateAll(object);
  }

  private async deleteRefObjects(
    internalId: string,
    admissionCategory: AdmissionCategory,
  ): Promise<Admission> {
    const internalValue: InternalValue = this.matchMap[admissionCategory];
    const objectId = new Types.ObjectId(internalId);
    const deleteRes = await internalValue.model.findByIdAndDelete(objectId);
    if (!deleteRes) {
      throw new Error(Errors.get(internalValue.errorType));
    }
    await internalValue.model.deleteOne({ _id: new Types.ObjectId(internalId) });
    const admission = await this.admissionModel.findOne({ [`${admissionCategory}`]: objectId });
    const removeRes = await this.admissionModel.findByIdAndUpdate(
      admission._id,
      { $pull: { [`${admissionCategory}`]: new Types.ObjectId(internalId) } },
      { upsert: false, new: true },
    );
    return this.populateAll(removeRes);
  }

  private async populateAll(object): Promise<Admission> {
    let result = cloneDeep(object);
    await Promise.all(
      Object.values(AdmissionCategory).map(async (admissionCategory) => {
        result = await result.populate(admissionCategory);
      }),
    );
    return this.replaceSubIds(result.toObject());
  }

  /**
   * @param object any db object
   * changing internal _id on sub array objects, for example :
   * {memberId, procedures: [{_id: "some_id"}]} will be {memberId, procedures: [{id: "some_id"}]}
   */
  private replaceSubIds(object) {
    Object.keys(object).map((key) => {
      if (object[key] instanceof Array) {
        object[key].map((item) => {
          if (item._id) {
            item.id = new Types.ObjectId(item._id);
            delete item._id;
          }
        });
      }
    });

    return object;
  }
}
