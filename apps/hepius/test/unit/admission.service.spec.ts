import { mockLogger, mockProcessWarnings } from '@argus/pandora';
import { Test, TestingModule } from '@nestjs/testing';
import { Model, Types, model } from 'mongoose';
import {
  ChangeType,
  ErrorType,
  Errors,
  LoggerService,
  defaultTimestampsDbValues,
} from '../../src/common';
import {
  Activity,
  ActivityDocument,
  ActivityDto,
  Admission,
  AdmissionCategory,
  AdmissionDocument,
  AdmissionDto,
  AdmissionService,
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
  MemberModule,
  Procedure,
  ProcedureDocument,
  ProcedureDto,
  WoundCare,
  WoundCareDocument,
  WoundCareDto,
} from '../../src/member';
import {
  dbConnect,
  dbDisconnect,
  defaultModules,
  generateAdmissionActivityParams,
  generateAdmissionDiagnosisParams,
  generateAdmissionDietaryParams,
  generateAdmissionExternalAppointmentParams,
  generateAdmissionMedicationParams,
  generateAdmissionProcedureParams,
  generateAdmissionWoundCareParams,
  generateId,
  removeChangeType,
} from '../index';

describe(AdmissionService.name, () => {
  let module: TestingModule;
  let service: AdmissionService;
  const mapAdmissionCategoryToParamField: Map<
    AdmissionCategory,
    { field: string; method; model?: typeof Model; errorNotFound?: ErrorType }
  > = new Map();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let admissionModel: Model<AdmissionDocument & defaultTimestampsDbValues>;
  let diagnosisModel: Model<DiagnosisDocument & defaultTimestampsDbValues>;
  let procedureModel: Model<ProcedureDocument & defaultTimestampsDbValues>;
  let medicationModel: Model<MedicationDocument & defaultTimestampsDbValues>;
  let externalAppointmentModel: Model<ExternalAppointmentDocument & defaultTimestampsDbValues>;
  let activityModel: Model<ActivityDocument & defaultTimestampsDbValues>;
  let woundCareModel: Model<WoundCareDocument & defaultTimestampsDbValues>;
  let dietaryModel: Model<DietaryDocument & defaultTimestampsDbValues>;

  beforeAll(async () => {
    mockProcessWarnings(); // to hide pino prettyPrint warning
    module = await Test.createTestingModule({
      imports: defaultModules().concat(MemberModule),
    }).compile();

    service = module.get<AdmissionService>(AdmissionService);
    mockLogger(module.get<LoggerService>(LoggerService));

    initModels();
    initMaps();

    await dbConnect();
  });

  afterAll(async () => {
    await module.close();
    await dbDisconnect();
  });

  test.each(Object.values(AdmissionCategory))(
    'should create 2 admissions entries with %p for a member, and 1 for other member',
    async (admissionCategory: AdmissionCategory) => {
      const { field, method, model } = mapAdmissionCategoryToParamField.get(admissionCategory);

      const changeParams1a = method({ changeType: ChangeType.create });
      const changeParams1b = method({ changeType: ChangeType.create });
      const changeParams2 = method({ changeType: ChangeType.create });

      const memberId1 = generateId();
      const ad1a = await change(field, changeParams1a, memberId1);
      const ad1b = await change(field, changeParams1b, memberId1);

      const memberId2 = generateId();
      const res2 = await change(field, changeParams2, memberId2);

      const { _id: id1a } = await model.findById(new Types.ObjectId(ad1a[admissionCategory][0].id));
      const { _id: id1b } = await model.findById(new Types.ObjectId(ad1b[admissionCategory][0].id));
      const { _id: id2 } = await model.findById(new Types.ObjectId(res2[admissionCategory][0].id));

      expect(ad1a).toMatchObject({
        memberId: new Types.ObjectId(memberId1),
        [`${admissionCategory}`]: [{ ...removeChangeType(changeParams1a), id: id1a }],
      });
      expect(ad1b).toMatchObject({
        memberId: new Types.ObjectId(memberId1),
        [`${admissionCategory}`]: [{ ...removeChangeType(changeParams1b), id: id1b }],
      });
      expect(res2).toMatchObject({
        memberId: new Types.ObjectId(memberId2),
        [`${admissionCategory}`]: [{ ...removeChangeType(changeParams2), id: id2 }],
      });

      const count1 = await admissionModel.count({ memberId: new Types.ObjectId(memberId1) });
      expect(count1).toEqual(2);
      const count2 = await admissionModel.count({ memberId: new Types.ObjectId(memberId2) });
      expect(count2).toEqual(1);
    },
  );

  test.each(Object.values(AdmissionCategory))(
    'should create and update a member %p',
    async (admissionCategory: AdmissionCategory) => {
      const { field, method, model } = mapAdmissionCategoryToParamField.get(admissionCategory);
      const memberId = generateId();

      const changeParams = method({ changeType: ChangeType.create });
      let result = await change(field, changeParams, memberId);

      const { id } = await model.findById(new Types.ObjectId(result[admissionCategory][0].id));

      const changeParamsUpdate = method({ changeType: ChangeType.update, id });
      result = await change(field, changeParamsUpdate, memberId, result.id.toString());

      expect(result).toMatchObject({
        memberId: new Types.ObjectId(memberId),
        [`${admissionCategory}`]: [
          { ...removeChangeType(changeParamsUpdate), id: new Types.ObjectId(id) },
        ],
      });

      const records = await admissionModel.count({ memberId: new Types.ObjectId(memberId) });
      expect(records).toEqual(1);
    },
  );

  test.each(Object.values(AdmissionCategory))(
    'should create and delete a member %p',
    async (admissionCategory: AdmissionCategory) => {
      const { field, method, model } = mapAdmissionCategoryToParamField.get(admissionCategory);
      const memberId = generateId();
      const changeParams = method({ changeType: ChangeType.create });

      const result = await change(field, changeParams, memberId);
      const { id } = await model.findById(new Types.ObjectId(result[admissionCategory][0].id));

      const deleteResult = await change(
        field,
        method({ changeType: ChangeType.delete, id }),
        memberId,
        result.id.toString(),
      );
      const afterDeleteResult = await model.findById(new Types.ObjectId(id));
      expect(afterDeleteResult).toBeNull();

      expect(deleteResult).toMatchObject({
        id: result.id,
        memberId: new Types.ObjectId(memberId),
        [`${admissionCategory}`]: [],
      });
    },
  );

  test.each(Object.values(AdmissionCategory))(
    `should throw error on ${ChangeType.update} %p with id not found`,
    async (admissionCategory) => {
      await checkThrowError(admissionCategory, ChangeType.update);
    },
  );

  test.each(Object.values(AdmissionCategory))(
    `should throw error on ${ChangeType.delete} %p with id not found`,
    async (admissionCategory) => {
      await checkThrowError(admissionCategory, ChangeType.delete);
    },
  );

  const checkThrowError = async (admissionCategory: AdmissionCategory, changeType: ChangeType) => {
    const { field, method, errorNotFound } =
      mapAdmissionCategoryToParamField.get(admissionCategory);
    const memberId = generateId();

    await expect(change(field, method({ changeType, id: generateId() }), memberId)).rejects.toThrow(
      Errors.get(errorNotFound),
    );
  };

  test.each`
    admissionCategory                         | key
    ${AdmissionCategory.diagnoses}            | ${'description'}
    ${AdmissionCategory.procedures}           | ${'text'}
    ${AdmissionCategory.medications}          | ${'name'}
    ${AdmissionCategory.externalAppointments} | ${'date'}
    ${AdmissionCategory.activities}           | ${'text'}
    ${AdmissionCategory.woundCares}           | ${'text'}
    ${AdmissionCategory.dietaries}            | ${'text'}
  `(
    `should remove null fields from create $admissionCategory params`,
    async ({ admissionCategory, key }) => {
      const { field, method, model } = mapAdmissionCategoryToParamField.get(admissionCategory);
      const memberId = generateId();

      const changeParams = method({ changeType: ChangeType.create });
      changeParams[key] = null;

      const result = await change(field, changeParams, memberId);

      const categoryRes = await model.findById(new Types.ObjectId(result[admissionCategory][0].id));
      expect(categoryRes.text).not.toBeDefined();
    },
  );

  test.each`
    admissionCategory                         | key
    ${AdmissionCategory.diagnoses}            | ${'description'}
    ${AdmissionCategory.procedures}           | ${'text'}
    ${AdmissionCategory.medications}          | ${'name'}
    ${AdmissionCategory.externalAppointments} | ${'date'}
    ${AdmissionCategory.activities}           | ${'text'}
    ${AdmissionCategory.woundCares}           | ${'text'}
    ${AdmissionCategory.dietaries}            | ${'text'}
  `(
    `should remove null fields from update $admissionCategory params`,
    async ({ admissionCategory, key }) => {
      const { field, method, model } = mapAdmissionCategoryToParamField.get(admissionCategory);
      const memberId = generateId();

      const createParams = method({ changeType: ChangeType.create });
      const result = await change(field, createParams, memberId);

      const { id } = await model.findById(new Types.ObjectId(result[admissionCategory][0].id));
      const updateParams = method({ changeType: ChangeType.update, id });
      updateParams[key] = null;

      await change(field, updateParams, memberId, result.id.toString());

      const categoryRes = await model.findById(new Types.ObjectId(id));
      expect(categoryRes[key]).toEqual(createParams[key]);
    },
  );

  it('should set appointment default isScheduled=true when not provided in params', async () => {
    const memberId = generateId();

    const admissionCategory = AdmissionCategory.externalAppointments;
    const { field, method } = mapAdmissionCategoryToParamField.get(admissionCategory);

    const externalAppointment = method({ changeType: ChangeType.create });
    delete externalAppointment.isScheduled;

    await change(field, externalAppointment, memberId);

    const { isScheduled } = await externalAppointmentModel.findOne(
      { date: externalAppointment.date },
      { isScheduled: 1 },
    );

    expect(isScheduled).toBeTruthy();
  });

  it('should set activity default isTodo=true when not provided in params', async () => {
    const memberId = generateId();
    const admissionCategory = AdmissionCategory.activities;
    const { field, method, model } = mapAdmissionCategoryToParamField.get(admissionCategory);

    const activity = method({ changeType: ChangeType.create });
    delete activity.isTodo;

    await change(field, activity, memberId);

    const { isTodo } = await model.findOne({ text: activity.text }, { isTodo: 1 });
    expect(isTodo).toBeTruthy();
  });

  it(`should return all populated existing values on ${ChangeType.create}`, async () => {
    const memberId = generateId();
    const createResult = await createAllCategories(memberId);

    //create another one and make sure it returns all the existing created values above
    const { field, method } = mapAdmissionCategoryToParamField.get(AdmissionCategory.procedures);
    const createParams = method({ changeType: ChangeType.create });
    const changeResult = await change(field, createParams, memberId, createResult.id);

    expect(changeResult[AdmissionCategory.procedures]).toEqual([
      expect.objectContaining({ date: expect.any(Date) }),
      expect.objectContaining({ date: expect.any(Date) }),
    ]);
    checkAllCategories(changeResult);
  });

  it(`should return all populated existing values on ${ChangeType.update}`, async () => {
    const memberId = generateId();
    let result = await createAllCategories(memberId);

    //update one and make sure it returns all the existing created values above
    const { field, method, model } = mapAdmissionCategoryToParamField.get(
      AdmissionCategory.procedures,
    );
    const { id } = await model.findById(
      new Types.ObjectId(result[AdmissionCategory.procedures][0].id),
    );
    const updateParams = method({ changeType: ChangeType.update, id });
    result = await change(field, updateParams, memberId, result.id.toString());

    expect(result[AdmissionCategory.procedures]).toEqual([
      expect.objectContaining({ date: updateParams.date }),
    ]);
    checkAllCategories(result);
  });

  it(`should return all populated existing values on ${ChangeType.delete}`, async () => {
    const memberId = generateId();
    const result = await createAllCategories(memberId);

    //update one and make sure it returns all the existing created values above
    const { field, method, model } = mapAdmissionCategoryToParamField.get(
      AdmissionCategory.procedures,
    );
    const { id } = await model.findById(
      new Types.ObjectId(result[AdmissionCategory.procedures][0].id),
    );
    const deleteParams = method({ changeType: ChangeType.delete, id });
    const deleteResult = await change(field, deleteParams, memberId, result.id.toString());

    expect(deleteResult[AdmissionCategory.procedures]).toEqual([]);
    checkAllCategories(deleteResult);
  });

  it('should return all 2 admissions for member with populated existing values', async () => {
    const memberId = generateId();
    await createAllCategories(memberId);
    await createAllCategories(memberId);

    const getResult = await service.get(memberId);
    checkAllCategories(getResult[0]);
    checkAllCategories(getResult[1]);
  });

  it('should return empty result for no admissions per member', async () => {
    const result = await service.get(generateId());
    expect(result).toEqual([]);
  });

  const createAllCategories = async (memberId: string): Promise<Admission> => {
    let result;
    //create synchronous categories(test fails on unique mongodb error for field memberId on async Promise.all)
    for (const admissionCategory of Object.values(AdmissionCategory)) {
      const { field, method } = mapAdmissionCategoryToParamField.get(admissionCategory);
      const createParams1 = method({ changeType: ChangeType.create });
      result = await change(field, createParams1, memberId, result?.id.toString());
    }

    return result;
  };

  const checkAllCategories = (result: Admission) => {
    expect(result[AdmissionCategory.diagnoses]).toEqual([
      expect.objectContaining({ description: expect.any(String) }),
    ]);
    expect(result[AdmissionCategory.medications]).toEqual([
      expect.objectContaining({ coachNote: expect.any(String) }),
    ]);
    expect(result[AdmissionCategory.externalAppointments]).toEqual([
      expect.objectContaining({ date: expect.any(Date) }),
    ]);
    expect(result[AdmissionCategory.activities]).toEqual([
      expect.objectContaining({ text: expect.any(String) }),
    ]);
    expect(result[AdmissionCategory.dietaries]).toEqual([
      expect.objectContaining({ text: expect.any(String) }),
    ]);
  };

  const change = async (
    field: string,
    params,
    memberId: string,
    id?: string,
  ): Promise<Admission> => {
    return service.change({ [`${field}`]: params, memberId, id });
  };

  const initModels = () => {
    admissionModel = model<AdmissionDocument & defaultTimestampsDbValues>(
      Admission.name,
      AdmissionDto,
    );
    diagnosisModel = model<DiagnosisDocument & defaultTimestampsDbValues>(
      Diagnosis.name,
      DiagnosisDto,
    );
    procedureModel = model<ProcedureDocument & defaultTimestampsDbValues>(
      Procedure.name,
      ProcedureDto,
    );
    medicationModel = model<MedicationDocument & defaultTimestampsDbValues>(
      Medication.name,
      MedicationDto,
    );
    externalAppointmentModel = model<ExternalAppointmentDocument & defaultTimestampsDbValues>(
      ExternalAppointment.name,
      ExternalAppointmentDto,
    );
    activityModel = model<ActivityDocument & defaultTimestampsDbValues>(Activity.name, ActivityDto);
    woundCareModel = model<WoundCareDocument & defaultTimestampsDbValues>(
      WoundCare.name,
      WoundCareDto,
    );
    dietaryModel = model<DietaryDocument & defaultTimestampsDbValues>(Dietary.name, DietaryDto);
  };

  const initMaps = () => {
    mapAdmissionCategoryToParamField.set(AdmissionCategory.diagnoses, {
      field: 'diagnosis',
      method: generateAdmissionDiagnosisParams,
      model: diagnosisModel,
      errorNotFound: ErrorType.admissionDiagnosisIdNotFound,
    });
    mapAdmissionCategoryToParamField.set(AdmissionCategory.procedures, {
      field: 'procedure',
      method: generateAdmissionProcedureParams,
      model: procedureModel,
      errorNotFound: ErrorType.admissionProcedureIdNotFound,
    });
    mapAdmissionCategoryToParamField.set(AdmissionCategory.medications, {
      field: 'medication',
      method: generateAdmissionMedicationParams,
      model: medicationModel,
      errorNotFound: ErrorType.admissionMedicationIdNotFound,
    });
    mapAdmissionCategoryToParamField.set(AdmissionCategory.externalAppointments, {
      field: 'externalAppointment',
      method: generateAdmissionExternalAppointmentParams,
      model: externalAppointmentModel,
      errorNotFound: ErrorType.admissionExternalAppointmentIdNotFound,
    });
    mapAdmissionCategoryToParamField.set(AdmissionCategory.activities, {
      field: 'activity',
      method: generateAdmissionActivityParams,
      model: activityModel,
      errorNotFound: ErrorType.admissionActivityIdNotFound,
    });
    mapAdmissionCategoryToParamField.set(AdmissionCategory.woundCares, {
      field: 'woundCare',
      method: generateAdmissionWoundCareParams,
      model: woundCareModel,
      errorNotFound: ErrorType.admissionWoundCareIdNotFound,
    });
    mapAdmissionCategoryToParamField.set(AdmissionCategory.dietaries, {
      field: 'dietary',
      method: generateAdmissionDietaryParams,
      model: dietaryModel,
      errorNotFound: ErrorType.admissionDietaryIdNotFound,
    });
  };
});
