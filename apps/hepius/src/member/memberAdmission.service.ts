import {
  Activity,
  ActivityDocument,
  BaseAdmission,
  ChangeAdmissionActivityParams,
  ChangeAdmissionExternalAppointmentParams,
  ChangeAdmissionMedicationParams,
  ChangeAdmissionParams,
  ChangeAdmissionProcedureParams,
  ChangeAdmissionWoundCareParams,
  ExternalAppointment,
  ExternalAppointmentDocument,
  Medication,
  MedicationDocument,
  MemberAdmission,
  MemberAdmissionDocument,
  Procedure,
  ProcedureDocument,
  RefAdmissionCategory,
  SingleValueAdmissionCategory,
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
export class MemberAdmissionService extends BaseService {
  private readonly matchMap: Map<RefAdmissionCategory, InternalValue> = new Map();

  constructor(
    @InjectModel(Procedure.name)
    private readonly procedureModel: Model<ProcedureDocument> & ISoftDelete<ProcedureDocument>,
    @InjectModel(Medication.name)
    private readonly medicationModel: Model<MedicationDocument> & ISoftDelete<MedicationDocument>,
    @InjectModel(MemberAdmission.name)
    private readonly admissionModel: Model<MemberAdmissionDocument> &
      ISoftDelete<MemberAdmissionDocument>,
    @InjectModel(ExternalAppointment.name)
    private readonly externalAppointmentModel: Model<ExternalAppointmentDocument> &
      ISoftDelete<ExternalAppointmentDocument>,
    @InjectModel(Activity.name)
    private readonly activityModel: Model<ActivityDocument> & ISoftDelete<ActivityDocument>,
    @InjectModel(WoundCare.name)
    private readonly woundCareModel: Model<WoundCareDocument> & ISoftDelete<WoundCareDocument>,
    readonly logger: LoggerService,
  ) {
    super();
    this.matchMap[RefAdmissionCategory.procedures] = {
      model: this.procedureModel,
      errorType: ErrorType.memberAdmissionProcedureIdNotFound,
    };
    this.matchMap[RefAdmissionCategory.medications] = {
      model: this.medicationModel,
      errorType: ErrorType.memberAdmissionMedicationIdNotFound,
    };
    this.matchMap[RefAdmissionCategory.externalAppointments] = {
      model: this.externalAppointmentModel,
      errorType: ErrorType.memberAdmissionExternalAppointmentIdNotFound,
    };
    this.matchMap[RefAdmissionCategory.activities] = {
      model: this.activityModel,
      errorType: ErrorType.memberAdmissionActivityIdNotFound,
    };
    this.matchMap[RefAdmissionCategory.woundCares] = {
      model: this.woundCareModel,
      errorType: ErrorType.memberAdmissionWoundCareIdNotFound,
    };
  }

  async changeAdmission(changeAdmissionParams: ChangeAdmissionParams): Promise<MemberAdmission> {
    const setParams: ChangeAdmissionParams = omitBy(changeAdmissionParams, isNil);
    const { memberId } = changeAdmissionParams;

    let result;
    if (setParams.diagnoses) {
      result = await this.updateSingleObject(
        { [`${SingleValueAdmissionCategory.diagnoses}`]: setParams.diagnoses },
        memberId,
      );
    }
    if (setParams.procedure) {
      const { changeType, ...procedure }: ChangeAdmissionProcedureParams = setParams.procedure;
      const admissionCategory = RefAdmissionCategory.procedures;
      result = await this.changeInternal(procedure, changeType, admissionCategory, memberId);
    }
    if (setParams.medication) {
      const { changeType, ...medication }: ChangeAdmissionMedicationParams = setParams.medication;
      const admissionCategory = RefAdmissionCategory.medications;
      result = await this.changeInternal(medication, changeType, admissionCategory, memberId);
    }
    if (setParams.externalAppointment) {
      const { changeType, ...externalAppointment }: ChangeAdmissionExternalAppointmentParams =
        setParams.externalAppointment;
      const admissionCategory = RefAdmissionCategory.externalAppointments;
      result = await this.changeInternal(
        externalAppointment,
        changeType,
        admissionCategory,
        memberId,
      );
    }
    if (setParams.activity) {
      const { changeType, ...activity }: ChangeAdmissionActivityParams = setParams.activity;
      const admissionCategory = RefAdmissionCategory.activities;
      result = await this.changeInternal(activity, changeType, admissionCategory, memberId);
    }
    if (setParams.woundCare) {
      const { changeType, ...woundCare }: ChangeAdmissionWoundCareParams = setParams.woundCare;
      const admissionCategory = RefAdmissionCategory.woundCares;
      result = await this.changeInternal(woundCare, changeType, admissionCategory, memberId);
    }
    if (setParams.dietary) {
      const values = { ...omitBy(setParams.dietary, isNil) };
      const parse = Object.keys(values).map((key) => ({
        [`${SingleValueAdmissionCategory.dietary}.${key}`]: values[key],
      }));
      result = await this.updateSingleObject(Object.assign({}, ...parse), memberId);
    }

    return this.replaceId(result);
  }

  /*************************************************************************************************
   ******************************************** Helpers ********************************************
   ************************************************************************************************/
  private async changeInternal(
    element: BaseAdmission,
    changeType: ChangeType,
    admissionCategory: RefAdmissionCategory,
    memberId: string,
  ): Promise<MemberAdmission> {
    switch (changeType) {
      case ChangeType.create:
        return this.createRefObjects(element, admissionCategory, memberId);
      case ChangeType.update:
        return this.updateRefObjects(element, admissionCategory, memberId);
      case ChangeType.delete:
        return this.deleteRefObjects(element.id, admissionCategory, memberId);
    }
  }

  private async createRefObjects(
    element: BaseAdmission,
    admissionCategory: RefAdmissionCategory,
    memberId: string,
  ): Promise<MemberAdmission> {
    const internalValue: InternalValue = this.matchMap[admissionCategory];
    const { _id } = await internalValue.model.create(omitBy(element, isNil));
    const addRes = await this.admissionModel.findOneAndUpdate(
      { memberId: new Types.ObjectId(memberId) },
      { $addToSet: { [`${admissionCategory}`]: _id } },
      { upsert: true, new: true },
    );

    return this.populateAll(addRes);
  }

  private async updateRefObjects(
    element: BaseAdmission,
    admissionCategory: RefAdmissionCategory,
    memberId: string,
  ): Promise<MemberAdmission> {
    const internalValue: InternalValue = this.matchMap[admissionCategory];
    const result = await internalValue.model.findByIdAndUpdate(new Types.ObjectId(element.id), {
      $set: { ...omitBy(element, isNil) },
    });
    if (!result) {
      throw new Error(Errors.get(internalValue.errorType));
    }
    const object = await this.admissionModel.findOne({ memberId: new Types.ObjectId(memberId) });
    return this.populateAll(object);
  }

  private async updateSingleObject(value, memberId: string): Promise<MemberAdmission> {
    const updateRes = await this.admissionModel.findOneAndUpdate(
      { memberId: new Types.ObjectId(memberId) },
      { $set: value },
      { new: true, upsert: true },
    );
    return this.populateAll(updateRes);
  }

  private async deleteRefObjects(
    id: string,
    admissionCategory: RefAdmissionCategory,
    memberId: string,
  ): Promise<MemberAdmission> {
    const internalValue: InternalValue = this.matchMap[admissionCategory];
    const deleteRes = await internalValue.model.findByIdAndDelete(new Types.ObjectId(id));
    if (!deleteRes) {
      throw new Error(Errors.get(internalValue.errorType));
    }
    await internalValue.model.deleteOne({ _id: new Types.ObjectId(id) });
    const removeRes = await this.admissionModel.findOneAndUpdate(
      { memberId: new Types.ObjectId(memberId) },
      { $pull: { [`${admissionCategory}`]: new Types.ObjectId(id) } },
      { upsert: true, new: true },
    );
    return this.populateAll(removeRes);
  }

  private async populateAll(object): Promise<MemberAdmission> {
    let result = cloneDeep(object);
    await Promise.all(
      Object.values(RefAdmissionCategory).map(async (admissionCategory) => {
        result = await result.populate(admissionCategory);
      }),
    );
    return this.replaceId(result.toObject());
  }
}
