import {
  Admission,
  AdmissionCategory,
  AdmissionDocument,
  BaseCategory,
  ChangeAdmissionDiagnosisParams,
  ChangeAdmissionDietaryParams,
  ChangeAdmissionExternalAppointmentParams,
  ChangeAdmissionMedicationParams,
  ChangeAdmissionTreatmentRenderedParams,
  ChangeMemberDnaParams,
  Diagnosis,
  DiagnosisDocument,
  Dietary,
  DietaryDocument,
  ExternalAppointment,
  ExternalAppointmentDocument,
  Medication,
  MedicationDocument,
  TreatmentRendered,
  TreatmentRenderedDocument,
  singleAdmissionItems,
} from '.';
import {
  BaseService,
  ChangeType,
  ErrorType,
  Errors,
  EventType,
  IEventDeleteMember,
  LoggerService,
  deleteMemberObjects,
} from '../common';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ISoftDelete } from '../db';
import { cloneDeep, isEmpty, isNil, omitBy } from 'lodash';
import { OnEvent } from '@nestjs/event-emitter';

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
    @InjectModel(TreatmentRendered.name)
    private readonly treatmentRenderedModel: Model<TreatmentRenderedDocument> &
      ISoftDelete<TreatmentRenderedDocument>,
    @InjectModel(Medication.name)
    private readonly medicationModel: Model<MedicationDocument> & ISoftDelete<MedicationDocument>,
    @InjectModel(Admission.name)
    private readonly admissionModel: Model<AdmissionDocument> & ISoftDelete<AdmissionDocument>,
    @InjectModel(ExternalAppointment.name)
    private readonly externalAppointmentModel: Model<ExternalAppointmentDocument> &
      ISoftDelete<ExternalAppointmentDocument>,
    @InjectModel(Dietary.name)
    private readonly dietaryModel: Model<DietaryDocument> & ISoftDelete<DietaryDocument>,
    readonly logger: LoggerService,
  ) {
    super();
    this.matchMap[AdmissionCategory.diagnoses] = {
      model: this.diagnosisModel,
      errorType: ErrorType.admissionDiagnosisIdNotFound,
    };
    this.matchMap[AdmissionCategory.treatmentRendereds] = {
      model: this.treatmentRenderedModel,
      errorType: ErrorType.admissionTreatmentRenderedIdNotFound,
    };
    this.matchMap[AdmissionCategory.medications] = {
      model: this.medicationModel,
      errorType: ErrorType.admissionMedicationIdNotFound,
    };
    this.matchMap[AdmissionCategory.externalAppointments] = {
      model: this.externalAppointmentModel,
      errorType: ErrorType.admissionExternalAppointmentIdNotFound,
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
    if (setParams.treatmentRendered) {
      const { changeType, ...treatmentRendered }: ChangeAdmissionTreatmentRenderedParams =
        setParams.treatmentRendered;
      const admissionCategory = AdmissionCategory.treatmentRendereds;
      result = await this.changeInternal(
        treatmentRendered,
        changeType,
        admissionCategory,
        memberId,
        id,
      );
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
    if (setParams.dietary) {
      const { changeType, ...dietary }: ChangeAdmissionDietaryParams = setParams.dietary;
      const admissionCategory = AdmissionCategory.dietaries;
      result = await this.changeInternal(dietary, changeType, admissionCategory, memberId, id);
    }

    const singleItems = {};
    Object.values(singleAdmissionItems).forEach((item) => {
      if (setParams[item]) {
        singleItems[item] = setParams[item];
      }
    });
    const noNilSingleItems = omitBy(singleItems, isNil);
    if (!isEmpty(noNilSingleItems)) {
      result = await this.updateSingleItem(noNilSingleItems, id);
    }

    return this.replaceId(this.replaceSubIds(result));
  }

  @OnEvent(EventType.onDeletedMember, { async: true })
  async deleteAdmissions(params: IEventDeleteMember) {
    const data = {
      params,
      logger: this.logger,
      methodName: this.deleteAdmissions.name,
      serviceName: AdmissionService.name,
    };
    await deleteMemberObjects<Model<AdmissionDocument> & ISoftDelete<AdmissionDocument>>({
      model: this.admissionModel,
      ...data,
    });

    await deleteMemberObjects<Model<DiagnosisDocument> & ISoftDelete<DiagnosisDocument>>({
      model: this.diagnosisModel,
      ...data,
    });

    await deleteMemberObjects<
      Model<TreatmentRenderedDocument> & ISoftDelete<TreatmentRenderedDocument>
    >({
      model: this.treatmentRenderedModel,
      ...data,
    });

    await deleteMemberObjects<Model<MedicationDocument> & ISoftDelete<MedicationDocument>>({
      model: this.medicationModel,
      ...data,
    });

    await deleteMemberObjects<
      Model<ExternalAppointmentDocument> & ISoftDelete<ExternalAppointmentDocument>
    >({
      model: this.externalAppointmentModel,
      ...data,
    });

    await deleteMemberObjects<Model<DietaryDocument> & ISoftDelete<DietaryDocument>>({
      model: this.dietaryModel,
      ...data,
    });
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
    const { _id } = await internalValue.model.create({
      ...omitBy(element, isNil),
      memberId: new Types.ObjectId(memberId),
    });
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

  private async updateSingleItem(object, id?: string): Promise<Admission> {
    let result;
    if (id) {
      result = await this.admissionModel.findByIdAndUpdate(new Types.ObjectId(id), object, {
        new: true,
      });
    } else {
      result = await this.admissionModel.create(object);
    }
    return this.populateAll(result);
  }

  /**
   * @param object any db object
   * changing internal _id on sub array objects, for example :
   * {memberId, diagnoses: [{_id: "some_id"}]} will be {memberId, diagnoses: [{id: "some_id"}]}
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
