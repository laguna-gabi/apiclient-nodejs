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
  Diagnosis,
  DiagnosisDocument,
  DiagnosisDto,
  ExternalAppointment,
  ExternalAppointmentDocument,
  ExternalAppointmentDto,
  Medication,
  MedicationDocument,
  MedicationDto,
  MemberAdmission,
  MemberAdmissionService,
  MemberModule,
  Procedure,
  ProcedureDocument,
  ProcedureDto,
  RefAdmissionCategory,
  SingleValueAdmissionCategory,
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

describe(MemberAdmissionService.name, () => {
  let module: TestingModule;
  let service: MemberAdmissionService;
  const mapRefAdmissionCategoryToParamField: Map<
    RefAdmissionCategory,
    { field: string; method; model?: typeof Model; errorNotFound?: ErrorType }
  > = new Map();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapSingleAdmissionCategoryToParamField: Map<SingleValueAdmissionCategory, any> = new Map();
  let diagnosisModel: Model<DiagnosisDocument & defaultTimestampsDbValues>;
  let procedureModel: Model<ProcedureDocument & defaultTimestampsDbValues>;
  let medicationModel: Model<MedicationDocument & defaultTimestampsDbValues>;
  let externalAppointmentModel: Model<ExternalAppointmentDocument & defaultTimestampsDbValues>;
  let activityModel: Model<ActivityDocument & defaultTimestampsDbValues>;
  let woundCareModel: Model<WoundCareDocument & defaultTimestampsDbValues>;

  beforeAll(async () => {
    mockProcessWarnings(); // to hide pino prettyPrint warning
    module = await Test.createTestingModule({
      imports: defaultModules().concat(MemberModule),
    }).compile();

    service = module.get<MemberAdmissionService>(MemberAdmissionService);
    mockLogger(module.get<LoggerService>(LoggerService));

    initModels();
    initMaps();

    await dbConnect();
  });

  afterAll(async () => {
    await module.close();
    await dbDisconnect();
  });

  test.each(Object.values(RefAdmissionCategory))(
    'should create 2 %p for a member, and 1 for other member',
    async (admissionCategory: RefAdmissionCategory) => {
      const { field, method, model } = mapRefAdmissionCategoryToParamField.get(admissionCategory);

      const changeParams1a = method({ changeType: ChangeType.create });
      const changeParams1b = method({ changeType: ChangeType.create });
      const changeParams2 = method({ changeType: ChangeType.create });

      const memberId1 = generateId();
      await change(field, changeParams1a, memberId1);
      const res1 = await change(field, changeParams1b, memberId1);

      const memberId2 = generateId();
      const res2 = await change(field, changeParams2, memberId2);

      const { _id: id1a } = await model.findById(new Types.ObjectId(res1[admissionCategory][0].id));
      const { _id: id1b } = await model.findById(new Types.ObjectId(res1[admissionCategory][1].id));
      const { _id: id2 } = await model.findById(new Types.ObjectId(res2[admissionCategory][0].id));

      expect(res1).toMatchObject({
        memberId: new Types.ObjectId(memberId1),
        [`${admissionCategory}`]: [
          { ...removeChangeType(changeParams1a), id: id1a },
          { ...removeChangeType(changeParams1b), id: id1b },
        ],
      });
      expect(res2).toMatchObject({
        memberId: new Types.ObjectId(memberId2),
        [`${admissionCategory}`]: [{ ...removeChangeType(changeParams2), id: id2 }],
      });
    },
  );

  test.each(Object.values(SingleValueAdmissionCategory))(
    'should create and update %p for memberA, and create for memberB',
    async (admissionCategory: SingleValueAdmissionCategory) => {
      const method = mapSingleAdmissionCategoryToParamField.get(admissionCategory);
      const changeParams1a = method();
      const changeParams1b = method();
      const changeParams2 = method();

      const memberId1 = generateId();
      const result1a = await change(admissionCategory, changeParams1a, memberId1);
      expect(result1a[admissionCategory]).toEqual(changeParams1a);

      const memberId2 = generateId();
      const result2 = await change(admissionCategory, changeParams2, memberId2);
      expect(result2[admissionCategory]).toEqual(changeParams2);

      const result1b = await change(admissionCategory, changeParams1b, memberId1);
      expect(result1b[admissionCategory]).toEqual(changeParams1b);
    },
  );

  test.each(Object.values(RefAdmissionCategory))(
    'should create and update a member %p',
    async (admissionCategory: RefAdmissionCategory) => {
      const { field, method, model } = mapRefAdmissionCategoryToParamField.get(admissionCategory);
      const memberId = generateId();

      const changeParams = method({ changeType: ChangeType.create });
      let result = await change(field, changeParams, memberId);

      const { id } = await model.findById(new Types.ObjectId(result[admissionCategory][0].id));

      const changeParamsUpdate = method({ changeType: ChangeType.update, id });
      result = await change(field, changeParamsUpdate, memberId);

      expect(result).toMatchObject({
        memberId: new Types.ObjectId(memberId),
        [`${admissionCategory}`]: [
          { ...removeChangeType(changeParamsUpdate), id: new Types.ObjectId(id) },
        ],
      });
    },
  );

  test.each(Object.values(RefAdmissionCategory))(
    'should create and delete a member %p',
    async (admissionCategory: RefAdmissionCategory) => {
      const { field, method, model } = mapRefAdmissionCategoryToParamField.get(admissionCategory);
      const memberId = generateId();
      const changeParams = method({ changeType: ChangeType.create });

      const result = await change(field, changeParams, memberId);
      const { id } = await model.findById(new Types.ObjectId(result[admissionCategory][0].id));

      const deleteResult = await change(
        field,
        method({ changeType: ChangeType.delete, id }),
        memberId,
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

  test.each`
    admissionCategory                            | changeType
    ${RefAdmissionCategory.procedures}           | ${ChangeType.update}
    ${RefAdmissionCategory.procedures}           | ${ChangeType.delete}
    ${RefAdmissionCategory.medications}          | ${ChangeType.update}
    ${RefAdmissionCategory.medications}          | ${ChangeType.delete}
    ${RefAdmissionCategory.externalAppointments} | ${ChangeType.update}
    ${RefAdmissionCategory.externalAppointments} | ${ChangeType.delete}
    ${RefAdmissionCategory.activities}           | ${ChangeType.update}
    ${RefAdmissionCategory.activities}           | ${ChangeType.delete}
    ${RefAdmissionCategory.woundCares}           | ${ChangeType.update}
    ${RefAdmissionCategory.woundCares}           | ${ChangeType.delete}
  `(
    `should throw error on $changeType $admissionCategory with id not found`,
    async ({ admissionCategory, changeType }) => {
      const { field, method, errorNotFound } =
        mapRefAdmissionCategoryToParamField.get(admissionCategory);
      const memberId = generateId();

      await expect(
        change(field, method({ changeType, id: generateId() }), memberId),
      ).rejects.toThrow(Errors.get(errorNotFound));
    },
  );

  test.each`
    admissionCategory                            | key
    ${RefAdmissionCategory.procedures}           | ${'text'}
    ${RefAdmissionCategory.medications}          | ${'name'}
    ${RefAdmissionCategory.externalAppointments} | ${'date'}
    ${RefAdmissionCategory.activities}           | ${'text'}
    ${RefAdmissionCategory.woundCares}           | ${'text'}
  `(
    `should remove null fields from create $admissionCategory params`,
    async ({ admissionCategory, key }) => {
      const { field, method, model } = mapRefAdmissionCategoryToParamField.get(admissionCategory);
      const memberId = generateId();

      const changeParams = method({ changeType: ChangeType.create });
      changeParams[key] = null;

      const result = await change(field, changeParams, memberId);

      const categoryRes = await model.findById(new Types.ObjectId(result[admissionCategory][0].id));
      expect(categoryRes.text).not.toBeDefined();
    },
  );

  test.each`
    admissionCategory                            | key
    ${RefAdmissionCategory.procedures}           | ${'text'}
    ${RefAdmissionCategory.medications}          | ${'name'}
    ${RefAdmissionCategory.externalAppointments} | ${'date'}
    ${RefAdmissionCategory.activities}           | ${'text'}
    ${RefAdmissionCategory.woundCares}           | ${'text'}
  `(
    `should remove null fields from update $admissionCategory params`,
    async ({ admissionCategory, key }) => {
      const { field, method, model } = mapRefAdmissionCategoryToParamField.get(admissionCategory);
      const memberId = generateId();

      const createParams = method({ changeType: ChangeType.create });
      const result = await change(field, createParams, memberId);

      const { id } = await model.findById(new Types.ObjectId(result[admissionCategory][0].id));
      const updateParams = method({ changeType: ChangeType.update, id });
      updateParams[key] = null;

      await change(field, updateParams, memberId);

      const categoryRes = await model.findById(new Types.ObjectId(id));
      expect(categoryRes[key]).toEqual(createParams[key]);
    },
  );

  // eslint-disable-next-line max-len
  it(`should remove null fields from create/update ${SingleValueAdmissionCategory.dietary} params`, async () => {
    const memberId = generateId();
    const admissionCategory = SingleValueAdmissionCategory.dietary;
    const method = mapSingleAdmissionCategoryToParamField.get(admissionCategory);

    const createParams = method();

    await change(admissionCategory, createParams, memberId);

    const updateParams = method();
    updateParams.text = null;

    const resultUpdate = await change(admissionCategory, updateParams, memberId);
    expect(resultUpdate[admissionCategory].text).toEqual(createParams.text);
    expect(resultUpdate[admissionCategory].bmi).toEqual(updateParams.bmi);
  });

  it('should set appointment default isScheduled=true when not provided in params', async () => {
    const memberId = generateId();

    const admissionCategory = RefAdmissionCategory.externalAppointments;
    const { field, method } = mapRefAdmissionCategoryToParamField.get(admissionCategory);

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
    const admissionCategory = RefAdmissionCategory.activities;
    const { field, method, model } = mapRefAdmissionCategoryToParamField.get(admissionCategory);

    const activity = method({ changeType: ChangeType.create });
    delete activity.isTodo;

    await change(field, activity, memberId);

    const { isTodo } = await model.findOne({ text: activity.text }, { isTodo: 1 });
    expect(isTodo).toBeTruthy();
  });

  it('should return all populated existing values on create', async () => {
    const memberId = generateId();
    await createAllCategories(memberId);

    //create another one and make sure it returns all the existing created values above
    const { field, method } = mapRefAdmissionCategoryToParamField.get(
      RefAdmissionCategory.procedures,
    );
    const createParams = method({ changeType: ChangeType.create });
    const result = await change(field, createParams, memberId);

    expect(result[RefAdmissionCategory.procedures]).toEqual([
      expect.objectContaining({ date: expect.any(Date) }),
      expect.objectContaining({ date: expect.any(Date) }),
    ]);
    checkAllCategories(result);
  });

  it('should return all populated existing values on single category create', async () => {
    const memberId = generateId();
    await createAllCategories(memberId);

    //create another one and make sure it returns all the existing created values above
    const method = mapSingleAdmissionCategoryToParamField.get(SingleValueAdmissionCategory.dietary);
    const createParams = method();
    const result = await change(SingleValueAdmissionCategory.dietary, createParams, memberId);

    checkAllCategories(result);
  });

  it('should return all populated existing values on update', async () => {
    const memberId = generateId();
    let result = await createAllCategories(memberId);

    //update one and make sure it returns all the existing created values above
    const { field, method, model } = mapRefAdmissionCategoryToParamField.get(
      RefAdmissionCategory.procedures,
    );
    const { id } = await model.findById(
      new Types.ObjectId(result[RefAdmissionCategory.procedures][0].id),
    );
    const updateParams = method({ changeType: ChangeType.update, id });
    result = await change(field, updateParams, memberId);

    expect(result[RefAdmissionCategory.procedures]).toEqual([
      expect.objectContaining({ date: updateParams.date }),
    ]);
    checkAllCategories(result);
  });

  it('should return all populated existing values on delete', async () => {
    const memberId = generateId();
    const result = await createAllCategories(memberId);

    //update one and make sure it returns all the existing created values above
    const { field, method, model } = mapRefAdmissionCategoryToParamField.get(
      RefAdmissionCategory.procedures,
    );
    const { id } = await model.findById(
      new Types.ObjectId(result[RefAdmissionCategory.procedures][0].id),
    );
    const deleteParams = method({ changeType: ChangeType.delete, id });
    const deleteResult = await change(field, deleteParams, memberId);

    expect(deleteResult[RefAdmissionCategory.procedures]).toEqual([]);
    checkAllCategories(deleteResult);
  });

  it('should return all populated existing values', async () => {
    const memberId = generateId();
    await createAllCategories(memberId);

    const getResult = await service.get(memberId);
    checkAllCategories(getResult);
  });

  it('should throw error on member not found when calling getAdmission', async () => {
    await expect(service.get(generateId())).rejects.toThrow(Errors.get(ErrorType.memberNotFound));
  });

  const createAllCategories = async (memberId: string): Promise<MemberAdmission> => {
    let result;
    //create synchronous categories(test fails on unique mongodb error for field memberId on async Promise.all)
    for (const admissionCategory of Object.values(RefAdmissionCategory)) {
      const { field, method } = mapRefAdmissionCategoryToParamField.get(admissionCategory);
      const createParams = method({ changeType: ChangeType.create });
      result = await change(field, createParams, memberId);
    }

    for (const admissionCategory of Object.values(SingleValueAdmissionCategory)) {
      const method = mapSingleAdmissionCategoryToParamField.get(admissionCategory);
      const params = method();
      result = await change(admissionCategory, params, memberId);
    }

    return result;
  };

  const checkAllCategories = (result: MemberAdmission) => {
    expect(result[RefAdmissionCategory.diagnoses]).toEqual([
      expect.objectContaining({ description: expect.any(String) }),
    ]);
    expect(result[RefAdmissionCategory.medications]).toEqual([
      expect.objectContaining({ coachNote: expect.any(String) }),
    ]);
    expect(result[RefAdmissionCategory.externalAppointments]).toEqual([
      expect.objectContaining({ date: expect.any(Date) }),
    ]);
    expect(result[RefAdmissionCategory.activities]).toEqual([
      expect.objectContaining({ text: expect.any(String) }),
    ]);
    expect(result[SingleValueAdmissionCategory.dietary]).toEqual(
      expect.objectContaining({ text: expect.any(String), bmi: expect.any(String) }),
    );
  };

  const change = async (field: string, params, memberId: string): Promise<MemberAdmission> => {
    return service.change({ [`${field}`]: params, memberId });
  };

  const initModels = () => {
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
  };

  const initMaps = () => {
    mapRefAdmissionCategoryToParamField.set(RefAdmissionCategory.diagnoses, {
      field: 'diagnosis',
      method: generateAdmissionDiagnosisParams,
      model: diagnosisModel,
      errorNotFound: ErrorType.memberAdmissionDiagnosisIdNotFound,
    });
    mapRefAdmissionCategoryToParamField.set(RefAdmissionCategory.procedures, {
      field: 'procedure',
      method: generateAdmissionProcedureParams,
      model: procedureModel,
      errorNotFound: ErrorType.memberAdmissionProcedureIdNotFound,
    });
    mapRefAdmissionCategoryToParamField.set(RefAdmissionCategory.medications, {
      field: 'medication',
      method: generateAdmissionMedicationParams,
      model: medicationModel,
      errorNotFound: ErrorType.memberAdmissionMedicationIdNotFound,
    });
    mapRefAdmissionCategoryToParamField.set(RefAdmissionCategory.externalAppointments, {
      field: 'externalAppointment',
      method: generateAdmissionExternalAppointmentParams,
      model: externalAppointmentModel,
      errorNotFound: ErrorType.memberAdmissionExternalAppointmentIdNotFound,
    });
    mapRefAdmissionCategoryToParamField.set(RefAdmissionCategory.activities, {
      field: 'activity',
      method: generateAdmissionActivityParams,
      model: activityModel,
      errorNotFound: ErrorType.memberAdmissionActivityIdNotFound,
    });
    mapRefAdmissionCategoryToParamField.set(RefAdmissionCategory.woundCares, {
      field: 'woundCare',
      method: generateAdmissionWoundCareParams,
      model: woundCareModel,
      errorNotFound: ErrorType.memberAdmissionWoundCareIdNotFound,
    });

    mapSingleAdmissionCategoryToParamField.set(
      SingleValueAdmissionCategory.dietary,
      generateAdmissionDietaryParams,
    );
  };
});
