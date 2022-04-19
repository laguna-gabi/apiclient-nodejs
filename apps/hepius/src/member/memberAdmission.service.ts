import {
  AdmissionType,
  BaseAdmission,
  ChangeAdmissionMedicationParams,
  ChangeAdmissionParams,
  ChangeAdmissionProcedureParams,
  Medication,
  MedicationDocument,
  MemberAdmission,
  MemberAdmissionDocument,
  Procedure,
  ProcedureDocument,
} from './memberAdmission.dto';
import { BaseService, ChangeType, ErrorType, Errors, LoggerService } from '../common';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ISoftDelete } from '../db';
import { isNil, omitBy } from 'lodash';

class InternalValue {
  model: typeof Model;
  errorType: ErrorType;
}

@Injectable()
export class MemberAdmissionService extends BaseService {
  private readonly matchMap: Map<AdmissionType, InternalValue> = new Map();

  constructor(
    @InjectModel(Procedure.name)
    private readonly procedureModel: Model<ProcedureDocument> & ISoftDelete<ProcedureDocument>,
    @InjectModel(Medication.name)
    private readonly medicationModel: Model<MedicationDocument> & ISoftDelete<MedicationDocument>,
    @InjectModel(MemberAdmission.name)
    private readonly admissionModel: Model<MemberAdmissionDocument> &
      ISoftDelete<MemberAdmissionDocument>,
    readonly logger: LoggerService,
  ) {
    super();
    this.matchMap[AdmissionType.procedures] = {
      model: this.procedureModel,
      errorType: ErrorType.memberAdmissionProcedureIdNotFound,
    };
    this.matchMap[AdmissionType.medications] = {
      model: this.medicationModel,
      errorType: ErrorType.memberAdmissionMedicationIdNotFound,
    };
  }

  async changeAdmission(
    changeAdmissionParams: ChangeAdmissionParams,
    memberId: string,
  ): Promise<MemberAdmission> {
    const setParams: ChangeAdmissionParams = omitBy(changeAdmissionParams, isNil);

    let result;
    if (setParams.procedure) {
      const { changeType, ...procedure }: ChangeAdmissionProcedureParams = setParams.procedure;
      const admissionType = AdmissionType.procedures;
      result = await this.changeInternal(procedure, changeType, admissionType, memberId);
    }
    if (setParams.medication) {
      const { changeType, ...medication }: ChangeAdmissionMedicationParams = setParams.medication;
      const admissionType = AdmissionType.medications;
      result = await this.changeInternal(medication, changeType, admissionType, memberId);
    }

    return result;
  }

  /*************************************************************************************************
   ******************************************** Helpers ********************************************
   ************************************************************************************************/
  private async changeInternal(
    element: BaseAdmission,
    changeType: ChangeType,
    admissionType: AdmissionType,
    memberId: string,
  ): Promise<MemberAdmission> {
    switch (changeType) {
      case ChangeType.create:
        return this.createRefObjects(element, admissionType, memberId);
      case ChangeType.update:
        return this.updateRefObjects(element, admissionType, memberId);
      case ChangeType.delete:
        return this.deleteRefObjects(element.id, admissionType, memberId);
    }
  }

  private async createRefObjects(
    element: BaseAdmission,
    admissionType: AdmissionType,
    memberId: string,
  ): Promise<MemberAdmission> {
    const internalValue: InternalValue = this.matchMap[admissionType];
    const { _id } = await internalValue.model.create(omitBy(element, isNil));
    const addRes = await this.admissionModel
      .findOneAndUpdate(
        { memberId: new Types.ObjectId(memberId) },
        { $addToSet: { [`${admissionType}`]: _id } },
        { upsert: true, new: true },
      )
      .populate(admissionType);
    return this.replaceId(addRes);
  }

  private async updateRefObjects(
    element: BaseAdmission,
    admissionType: AdmissionType,
    memberId: string,
  ): Promise<MemberAdmission> {
    const internalValue: InternalValue = this.matchMap[admissionType];
    const result = await internalValue.model.findByIdAndUpdate(new Types.ObjectId(element.id), {
      $set: { ...omitBy(element, isNil) },
    });
    if (!result) {
      throw new Error(Errors.get(internalValue.errorType));
    }
    return this.admissionModel.findById(memberId);
  }

  private async deleteRefObjects(
    id: string,
    admissionType: AdmissionType,
    memberId: string,
  ): Promise<MemberAdmission> {
    const internalValue: InternalValue = this.matchMap[admissionType];
    const deleteRes = await internalValue.model.findByIdAndDelete(new Types.ObjectId(id));
    if (!deleteRes) {
      throw new Error(Errors.get(internalValue.errorType));
    }
    await internalValue.model.deleteOne({ _id: new Types.ObjectId(id) });
    const removeRes = await this.admissionModel
      .findOneAndUpdate(
        { memberId: new Types.ObjectId(memberId) },
        { $pull: { [`${admissionType}`]: new Types.ObjectId(id) } },
        { upsert: true, new: true },
      )
      .populate(admissionType);
    return this.replaceId(removeRes);
  }
}
