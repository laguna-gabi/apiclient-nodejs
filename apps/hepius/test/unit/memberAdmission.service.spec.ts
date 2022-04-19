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
  AdmissionCategory,
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
} from '../../src/member';
import {
  dbConnect,
  dbDisconnect,
  defaultModules,
  generateAdmissionActivityParams,
  generateAdmissionExternalAppointmentParams,
  generateAdmissionMedicationParams,
  generateAdmissionProcedureParams,
  generateId,
} from '../index';

describe(MemberAdmissionService.name, () => {
  let module: TestingModule;
  let service: MemberAdmissionService;
  const mapAdmissionCategoryToParamField: Map<
    AdmissionCategory,
    { field: string; method?; model?: typeof Model; errorNotFound?: ErrorType }
  > = new Map();
  let procedureModel: Model<ProcedureDocument & defaultTimestampsDbValues>;
  let medicationModel: Model<MedicationDocument & defaultTimestampsDbValues>;
  let externalAppointmentModel: Model<ExternalAppointmentDocument & defaultTimestampsDbValues>;
  let activityModel: Model<ActivityDocument & defaultTimestampsDbValues>;

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

  test.each([
    AdmissionCategory.procedures,
    AdmissionCategory.medications,
    AdmissionCategory.externalAppointments,
    AdmissionCategory.activities,
  ])(
    'should create 2 %p for a member, and 1 for other member',
    async (admissionCategory: AdmissionCategory) => {
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

  test.each([
    AdmissionCategory.procedures,
    AdmissionCategory.medications,
    AdmissionCategory.externalAppointments,
    AdmissionCategory.activities,
  ])('should create and update a member %p', async (admissionCategory: AdmissionCategory) => {
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
  });

  test.each([
    AdmissionCategory.procedures,
    AdmissionCategory.medications,
    AdmissionCategory.externalAppointments,
    AdmissionCategory.activities,
  ])('should create and update a member %p', async (admissionCategory: AdmissionCategory) => {
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
  });

  test.each`
    admissionCategory                         | changeType
    ${AdmissionCategory.procedures}           | ${ChangeType.update}
    ${AdmissionCategory.procedures}           | ${ChangeType.delete}
    ${AdmissionCategory.medications}          | ${ChangeType.update}
    ${AdmissionCategory.medications}          | ${ChangeType.delete}
    ${AdmissionCategory.externalAppointments} | ${ChangeType.update}
    ${AdmissionCategory.externalAppointments} | ${ChangeType.delete}
    ${AdmissionCategory.activities}           | ${ChangeType.update}
    ${AdmissionCategory.activities}           | ${ChangeType.delete}
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
    admissionCategory                         | key
    ${AdmissionCategory.procedures}           | ${'text'}
    ${AdmissionCategory.medications}          | ${'name'}
    ${AdmissionCategory.externalAppointments} | ${'date'}
    ${AdmissionCategory.activities}           | ${'text'}
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
    admissionCategory                         | key
    ${AdmissionCategory.procedures}           | ${'text'}
    ${AdmissionCategory.medications}          | ${'name'}
    ${AdmissionCategory.externalAppointments} | ${'date'}
    ${AdmissionCategory.activities}           | ${'text'}
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
  };

  const initMap = () => {
    mapAdmissionCategoryToParamField.set(AdmissionCategory.diagnoses, { field: 'diagnoses' });
    mapAdmissionCategoryToParamField.set(AdmissionCategory.procedures, {
      field: 'procedure',
      method: generateAdmissionProcedureParams,
      model: procedureModel,
      errorNotFound: ErrorType.memberAdmissionProcedureIdNotFound,
    });
    mapAdmissionCategoryToParamField.set(AdmissionCategory.medications, {
      field: 'medication',
      method: generateAdmissionMedicationParams,
      model: medicationModel,
      errorNotFound: ErrorType.memberAdmissionMedicationIdNotFound,
    });
    mapAdmissionCategoryToParamField.set(AdmissionCategory.externalAppointments, {
      field: 'externalAppointment',
      method: generateAdmissionExternalAppointmentParams,
      model: externalAppointmentModel,
      errorNotFound: ErrorType.memberAdmissionExternalAppointmentIdNotFound,
    });
    mapAdmissionCategoryToParamField.set(AdmissionCategory.activities, {
      field: 'activity',
      method: generateAdmissionActivityParams,
      model: activityModel,
      errorNotFound: ErrorType.memberAdmissionActivityIdNotFound,
    });
    mapAdmissionCategoryToParamField.set(AdmissionCategory.woundCares, { field: 'woundCare' });
    mapAdmissionCategoryToParamField.set(AdmissionCategory.dietary, { field: 'dietary' });
  };
});
