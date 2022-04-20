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
  BaseAdmission,
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
  WoundCare,
  WoundCareDocument,
  WoundCareDto,
} from '../../src/member';
import {
  dbConnect,
  dbDisconnect,
  defaultModules,
  generateAdmissionActivityParams,
  generateAdmissionExternalAppointmentParams,
  generateAdmissionMedicationParams,
  generateAdmissionProcedureParams,
  generateAdmissionWoundCareParams,
  generateId,
} from '../index';

describe(MemberAdmissionService.name, () => {
  let module: TestingModule;
  let service: MemberAdmissionService;
  const mapAdmissionCategoryToParamField: Map<
    RefAdmissionCategory,
    { field: string; method?; model?: typeof Model; errorNotFound?: ErrorType }
  > = new Map();
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
    initMap();

    await dbConnect();
  });

  afterAll(async () => {
    await module.close();
    await dbDisconnect();
  });

  test.each(Object.values(RefAdmissionCategory))(
    'should create 2 %p for a member, and 1 for other member',
    async (admissionCategory: RefAdmissionCategory) => {
      const { field, method, model } = mapAdmissionCategoryToParamField.get(admissionCategory);

      const changeParams1a = method({ changeType: ChangeType.create });
      const changeParams1b = method({ changeType: ChangeType.create });
      const changeParams2 = method({ changeType: ChangeType.create });

      const memberId1 = generateId();
      await changeAdmission(field, changeParams1a, memberId1);
      const result1 = await changeAdmission(field, changeParams1b, memberId1);

      const memberId2 = generateId();
      const result2 = await changeAdmission(field, changeParams2, memberId2);

      const { _id: id1a } = await model.findById(result1[admissionCategory][0], { _id: 1 });
      const { _id: id1b } = await model.findById(result1[admissionCategory][1], { _id: 1 });
      const { _id: id2 } = await model.findById(result2[admissionCategory][0], { _id: 1 });

      expect(result1).toMatchObject({
        memberId: new Types.ObjectId(memberId1),
        [`${admissionCategory}`]: [new Types.ObjectId(id1a), new Types.ObjectId(id1b)],
      });
      expect(result2).toMatchObject({
        memberId: new Types.ObjectId(memberId2),
        [`${admissionCategory}`]: [new Types.ObjectId(id2)],
      });
    },
  );

  test.each(Object.values(RefAdmissionCategory))(
    'should create and update a member %p',
    async (admissionCategory: RefAdmissionCategory) => {
      const { field, method, model } = mapAdmissionCategoryToParamField.get(admissionCategory);
      const memberId = generateId();

      const changeParams = method({ changeType: ChangeType.create });
      let result = await changeAdmission(field, changeParams, memberId);

      const { id } = await model.findById(result[admissionCategory][0]);

      const changeParamsUpdate = method({ changeType: ChangeType.update, id });
      result = await changeAdmission(field, changeParamsUpdate, memberId);
      const updatedCategoryResult = await model.findById(result[admissionCategory][0]);

      expect(updatedCategoryResult.toObject()).toEqual(
        expect.objectContaining(updatedCategoryResult.toObject()),
      );

      expect(result).toMatchObject({
        memberId: new Types.ObjectId(memberId),
        [`${admissionCategory}`]: [new Types.ObjectId(id)],
      });
    },
  );

  test.each(Object.values(RefAdmissionCategory))(
    'should create and delete a member %p',
    async (admissionCategory: RefAdmissionCategory) => {
      const { field, method, model } = mapAdmissionCategoryToParamField.get(admissionCategory);
      const memberId = generateId();
      const changeParams = method({ changeType: ChangeType.create });

      const result = await changeAdmission(field, changeParams, memberId);

      const { id } = await model.findById(result[admissionCategory][0]);

      const deleteResult = await changeAdmission(
        field,
        method({ changeType: ChangeType.delete, id }),
        memberId,
      );
      const afterDeleteResult = await model.findById(result[admissionCategory][0]);
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
        mapAdmissionCategoryToParamField.get(admissionCategory);
      const memberId = generateId();

      await expect(
        service.changeAdmission(
          { [`${field}`]: method({ changeType, id: generateId() }) },
          memberId,
        ),
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
      const { field, method, model } = mapAdmissionCategoryToParamField.get(admissionCategory);
      const memberId = generateId();

      const changeParams = method({ changeType: ChangeType.create });
      changeParams[key] = null;

      const result = await changeAdmission(field, changeParams, memberId);

      const categoryRes = await model.findById(result[admissionCategory][0]);
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
      const { field, method, model } = mapAdmissionCategoryToParamField.get(admissionCategory);
      const memberId = generateId();

      const createParams = method({ changeType: ChangeType.create });
      const result = await changeAdmission(field, createParams, memberId);

      const { id } = await model.findById(result[admissionCategory][0]);
      const updateParams = method({ changeType: ChangeType.update, id });
      updateParams[key] = null;

      await changeAdmission(field, updateParams, memberId);

      const categoryRes = await model.findById(new Types.ObjectId(id));
      expect(categoryRes[key]).toEqual(createParams[key]);
    },
  );

  it('should set appointment default isScheduled=true when not provided in params', async () => {
    const memberId = generateId();
    const externalAppointment = generateAdmissionExternalAppointmentParams({
      changeType: ChangeType.create,
    });
    delete externalAppointment.isScheduled;

    await service.changeAdmission({ externalAppointment }, memberId);

    const { isScheduled } = await externalAppointmentModel.findOne(
      { date: externalAppointment.date },
      { isScheduled: 1 },
    );

    expect(isScheduled).toBeTruthy();
  });

  it('should set activity default isTodo=true when not provided in params', async () => {
    const memberId = generateId();
    const activity = generateAdmissionActivityParams({
      changeType: ChangeType.create,
    });
    delete activity.isTodo;

    await service.changeAdmission({ activity }, memberId);

    const { isTodo } = await activityModel.findOne({ text: activity.text }, { isTodo: 1 });
    expect(isTodo).toBeTruthy();
  });

  it('should return all populated existing values on create', async () => {
    const memberId = generateId();

    //create synchronous categories(test fails on unique mongodb error for field memberId on async Promise.all)
    for (const admissionCategory of Object.values(RefAdmissionCategory)) {
      const { field, method } = mapAdmissionCategoryToParamField.get(admissionCategory);
      const createParams = method({ changeType: ChangeType.create });
      await changeAdmission(field, createParams, memberId);
    }

    //create another one and make sure it returns all the existing created values above
    const { field, method } = mapAdmissionCategoryToParamField.get(RefAdmissionCategory.procedures);
    const createParams = method({ changeType: ChangeType.create });
    const result = await changeAdmission(field, createParams, memberId);

    expect(result[RefAdmissionCategory.procedures]).toEqual([
      expect.objectContaining({ date: expect.any(Date) }),
      expect.objectContaining({ date: expect.any(Date) }),
    ]);
    checkPopulatedValues(result);
  });

  it('should return all populated existing values on update', async () => {
    const memberId = generateId();

    let result;
    //create synchronous categories(test fails on unique mongodb error for field memberId on async Promise.all)
    for (const admissionCategory of Object.values(RefAdmissionCategory)) {
      const { field, method } = mapAdmissionCategoryToParamField.get(admissionCategory);
      const createParams = method({ changeType: ChangeType.create });
      result = await changeAdmission(field, createParams, memberId);
    }

    //update one and make sure it returns all the existing created values above
    const { field, method, model } = mapAdmissionCategoryToParamField.get(
      RefAdmissionCategory.procedures,
    );
    const { id } = await model.findById(result[RefAdmissionCategory.procedures][0]);
    const updateParams = method({ changeType: ChangeType.update, id });
    result = await changeAdmission(field, updateParams, memberId);

    expect(result[RefAdmissionCategory.procedures]).toEqual([
      expect.objectContaining({ date: updateParams.date }),
    ]);
    checkPopulatedValues(result);
  });

  it('should return all populated existing values on delete', async () => {
    const memberId = generateId();
    const result = await createAllCategories(memberId);

    //update one and make sure it returns all the existing created values above
    const { field, method, model } = mapAdmissionCategoryToParamField.get(
      RefAdmissionCategory.procedures,
    );
    const { id } = await model.findById(result[RefAdmissionCategory.procedures][0]);
    const deleteParams = method({ changeType: ChangeType.delete, id });
    const deleteResult = await changeAdmission(field, deleteParams, memberId);

    expect(deleteResult[RefAdmissionCategory.procedures]).toEqual([]);
    checkPopulatedValues(deleteResult);
  });

  const createAllCategories = async (memberId: string): Promise<MemberAdmission> => {
    let result;
    //create synchronous categories(test fails on unique mongodb error for field memberId on async Promise.all)
    for (const admissionCategory of Object.values(RefAdmissionCategory)) {
      const { field, method } = mapAdmissionCategoryToParamField.get(admissionCategory);
      const createParams = method({ changeType: ChangeType.create });
      result = await changeAdmission(field, createParams, memberId);
    }

    return result;
  };

  const checkPopulatedValues = (result: MemberAdmission) => {
    expect(result[RefAdmissionCategory.medications]).toEqual([
      expect.objectContaining({ coachNote: expect.any(String) }),
    ]);
    expect(result[RefAdmissionCategory.externalAppointments]).toEqual([
      expect.objectContaining({ date: expect.any(Date) }),
    ]);
    expect(result[RefAdmissionCategory.activities]).toEqual([
      expect.objectContaining({ text: expect.any(String) }),
    ]);
  };

  const changeAdmission = async (
    field: string,
    params: BaseAdmission,
    memberId: string,
  ): Promise<MemberAdmission> => {
    return service.changeAdmission({ [`${field}`]: params }, memberId);
  };

  const initModels = () => {
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

  const initMap = () => {
    mapAdmissionCategoryToParamField.set(RefAdmissionCategory.procedures, {
      field: 'procedure',
      method: generateAdmissionProcedureParams,
      model: procedureModel,
      errorNotFound: ErrorType.memberAdmissionProcedureIdNotFound,
    });
    mapAdmissionCategoryToParamField.set(RefAdmissionCategory.medications, {
      field: 'medication',
      method: generateAdmissionMedicationParams,
      model: medicationModel,
      errorNotFound: ErrorType.memberAdmissionMedicationIdNotFound,
    });
    mapAdmissionCategoryToParamField.set(RefAdmissionCategory.externalAppointments, {
      field: 'externalAppointment',
      method: generateAdmissionExternalAppointmentParams,
      model: externalAppointmentModel,
      errorNotFound: ErrorType.memberAdmissionExternalAppointmentIdNotFound,
    });
    mapAdmissionCategoryToParamField.set(RefAdmissionCategory.activities, {
      field: 'activity',
      method: generateAdmissionActivityParams,
      model: activityModel,
      errorNotFound: ErrorType.memberAdmissionActivityIdNotFound,
    });
    mapAdmissionCategoryToParamField.set(RefAdmissionCategory.woundCares, {
      field: 'woundCare',
      method: generateAdmissionWoundCareParams,
      model: woundCareModel,
      errorNotFound: ErrorType.memberAdmissionWoundCareIdNotFound,
    });
  };
});
