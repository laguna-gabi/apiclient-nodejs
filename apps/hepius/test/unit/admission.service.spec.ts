import { mockLogger, mockProcessWarnings } from '@argus/pandora';
import { Test, TestingModule } from '@nestjs/testing';
import { Types } from 'mongoose';
import { ChangeType, Errors, LoggerService } from '../../src/common';
import {
  Admission,
  AdmissionCategory,
  AdmissionService,
  AdmitSource,
  AdmitType,
  ChangeMemberDnaParams,
  DischargeTo,
  MemberModule,
  PrimaryDiagnosisType,
  WarningSigns,
} from '../../src/member';
import {
  dbConnect,
  dbDisconnect,
  defaultModules,
  generateAdmissionDiagnosisParams,
  generateDateOnly,
  generateId,
  removeChangeType,
} from '../index';
import { AdmissionHelper } from '../aux';
import { subDays } from 'date-fns';
import { date, lorem } from 'faker';

describe(AdmissionService.name, () => {
  let module: TestingModule;
  let service: AdmissionService;
  const admissionHelper: AdmissionHelper = new AdmissionHelper();

  beforeAll(async () => {
    mockProcessWarnings(); // to hide pino prettyPrint warning
    module = await Test.createTestingModule({
      imports: defaultModules().concat(MemberModule),
    }).compile();

    service = module.get<AdmissionService>(AdmissionService);
    mockLogger(module.get<LoggerService>(LoggerService));

    await dbConnect();
  });

  afterAll(async () => {
    await module.close();
    await dbDisconnect();
  });

  test.each(Object.values(AdmissionCategory))(
    'should create 2 admissions entries with %p for a member, and 1 for other member',
    async (admissionCategory: AdmissionCategory) => {
      const { field, method, model } = admissionHelper.mapper.get(admissionCategory);

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

      const count1 = await admissionHelper.admissionModel.count({
        memberId: new Types.ObjectId(memberId1),
      });
      expect(count1).toEqual(2);
      const count2 = await admissionHelper.admissionModel.count({
        memberId: new Types.ObjectId(memberId2),
      });
      expect(count2).toEqual(1);
    },
  );

  test.each([
    { admitDate: generateDateOnly(subDays(new Date(), 5)) },
    { admitType: AdmitType.urgent },
    { admitSource: AdmitSource.hmoReferral },
    { dischargeDate: generateDateOnly(subDays(new Date(), 5)) },
    { dischargeTo: DischargeTo.anotherTypeOfInstitutionForInpatientCare },
    { facility: lorem.sentence() },
    { specialInstructions: lorem.sentences() },
    { reasonForAdmission: lorem.sentences() },
    { hospitalCourse: lorem.sentences() },
    { warningSigns: [WarningSigns.confusion, WarningSigns.passingOut] },
    {
      admitDate: generateDateOnly(subDays(new Date(), 5)),
      admitType: AdmitType.urgent,
      admitSource: AdmitSource.hmoReferral,
      dischargeDate: generateDateOnly(subDays(new Date(), 5)),
      dischargeTo: DischargeTo.anotherTypeOfInstitutionForInpatientCare,
      facility: lorem.sentence(),
      specialInstructions: lorem.sentences(),
      reasonForAdmission: lorem.sentences(),
      hospitalCourse: lorem.sentences(),
      warningSigns: [WarningSigns.confusion, WarningSigns.passingOut],
    },
  ])(`should create a single element in admission`, async (object) => {
    const changeMemberDnaParams: ChangeMemberDnaParams = { ...object, memberId: generateId() };
    const result = await service.change(changeMemberDnaParams);

    delete changeMemberDnaParams.memberId;
    expect(result).toMatchObject(changeMemberDnaParams);
  });

  /* eslint-disable max-len */
  test.each`
    field                    | input1                            | input2
    ${'admitDate'}           | ${generateDateOnly(date.soon())}  | ${generateDateOnly(date.soon())}
    ${'admitType'}           | ${AdmitType.snf}                  | ${AdmitType.psych}
    ${'admitSource'}         | ${AdmitSource.hmoReferral}        | ${AdmitSource.clinicReferral}
    ${'dischargeDate'}       | ${generateDateOnly(date.soon())}  | ${generateDateOnly(date.soon())}
    ${'dischargeTo'}         | ${DischargeTo.snf}                | ${DischargeTo.expired}
    ${'facility'}            | ${lorem.sentence()}               | ${lorem.sentence()}
    ${'specialInstructions'} | ${lorem.sentences()}              | ${lorem.sentences()}
    ${'reasonForAdmission'}  | ${lorem.sentences()}              | ${lorem.sentences()}
    ${'hospitalCourse'}      | ${lorem.sentences()}              | ${lorem.sentences()}
    ${'warningSigns'}        | ${[WarningSigns.severeDizziness]} | ${[WarningSigns.confusion, WarningSigns.passingOut]}
  `(
    `should create and update only date $field element in admission`,
    async ({ field, input1, input2 }) => {
      /* eslint-enable max-len */
      const memberId = generateId();
      const changeMemberDnaParams: ChangeMemberDnaParams = { [`${field}`]: input1, memberId };
      const result = await service.change(changeMemberDnaParams);

      const updatedResult = await service.change({ [`${field}`]: input2, id: result.id, memberId });
      expect(updatedResult[field]).toEqual(input2);
      expect(updatedResult.id).toEqual(result.id);
    },
  );

  test.each`
    field                    | input
    ${'admitDate'}           | ${generateDateOnly(date.soon())}
    ${'admitType'}           | ${AdmitType.snf}
    ${'admitSource'}         | ${AdmitSource.hmoReferral}
    ${'dischargeDate'}       | ${generateDateOnly(date.soon())}
    ${'dischargeTo'}         | ${DischargeTo.hospiceHome}
    ${'facility'}            | ${lorem.sentence()}
    ${'specialInstructions'} | ${lorem.sentences()}
    ${'reasonForAdmission'}  | ${lorem.sentences()}
    ${'hospitalCourse'}      | ${lorem.sentences()}
    ${'warningSigns'}        | ${[WarningSigns.confusion, WarningSigns.severeDizziness]}
  `(`should not update $field when its null`, async ({ field, input }) => {
    const memberId = generateId();
    const changeMemberDnaParams: ChangeMemberDnaParams = { [`${field}`]: input, memberId };
    const result = await service.change(changeMemberDnaParams);

    const newChange = {
      [`${field}`]: null,
      diagnosis: generateAdmissionDiagnosisParams({ changeType: ChangeType.create }),
      id: result.id.toString(),
      memberId,
    };
    const updatedResult = await service.change(newChange);
    expect(updatedResult[field]).toEqual(input);
    expect(updatedResult.id).toEqual(result.id);
  });

  test.each(Object.values(AdmissionCategory))(
    'should create and update a member %p',
    async (admissionCategory: AdmissionCategory) => {
      const { field, method, model } = admissionHelper.mapper.get(admissionCategory);
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

      const records = await admissionHelper.admissionModel.count({
        memberId: new Types.ObjectId(memberId),
      });
      expect(records).toEqual(1);
    },
  );

  test.each(Object.values(AdmissionCategory))(
    'should create and delete a member %p',
    async (admissionCategory: AdmissionCategory) => {
      const { field, method, model } = admissionHelper.mapper.get(admissionCategory);
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
    const { field, method, errorNotFound } = admissionHelper.mapper.get(admissionCategory);
    const memberId = generateId();

    await expect(change(field, method({ changeType, id: generateId() }), memberId)).rejects.toThrow(
      Errors.get(errorNotFound),
    );
  };

  test.each`
    admissionCategory                         | key
    ${AdmissionCategory.diagnoses}            | ${'description'}
    ${AdmissionCategory.procedures}           | ${'description'}
    ${AdmissionCategory.medications}          | ${'name'}
    ${AdmissionCategory.externalAppointments} | ${'date'}
    ${AdmissionCategory.activities}           | ${'text'}
    ${AdmissionCategory.woundCares}           | ${'text'}
    ${AdmissionCategory.dietaries}            | ${'text'}
  `(
    `should remove null fields from create $admissionCategory params`,
    async ({ admissionCategory, key }) => {
      const { field, method, model } = admissionHelper.mapper.get(admissionCategory);
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
      const { field, method, model } = admissionHelper.mapper.get(admissionCategory);
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

  test.each`
    admissionCategory                         | key              | defaultValue
    ${AdmissionCategory.externalAppointments} | ${'isScheduled'} | ${true}
    ${AdmissionCategory.diagnoses}            | ${'primaryType'} | ${PrimaryDiagnosisType.clinical}
  `(
    'should set $admissionCategory default $key when not provided in params',
    async ({ admissionCategory, key, defaultValue }) => {
      const memberId = generateId();
      const { field, method, model } = admissionHelper.mapper.get(admissionCategory);

      const createParams = method({ changeType: ChangeType.create });
      delete createParams[key];

      await change(field, createParams, memberId);

      const result = await model.findOne({}, {}, { sort: { _id: -1 } });
      expect(result[key]).toEqual(defaultValue);
    },
  );

  it('should set activity default isTodo=true when not provided in params', async () => {
    const memberId = generateId();
    const admissionCategory = AdmissionCategory.activities;
    const { field, method, model } = admissionHelper.mapper.get(admissionCategory);

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
    const { field, method } = admissionHelper.mapper.get(AdmissionCategory.procedures);
    const createParams = method({ changeType: ChangeType.create });
    const changeResult = await change(field, createParams, memberId, createResult.id);

    expect(changeResult[AdmissionCategory.procedures]).toEqual([
      expect.objectContaining({ description: expect.any(String) }),
      expect.objectContaining({ description: expect.any(String) }),
    ]);
    checkAllCategories(changeResult);
  });

  it(`should return all populated existing values on ${ChangeType.update}`, async () => {
    const memberId = generateId();
    let result = await createAllCategories(memberId);

    //update one and make sure it returns all the existing created values above
    const { field, method, model } = admissionHelper.mapper.get(AdmissionCategory.procedures);
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
    const { field, method, model } = admissionHelper.mapper.get(AdmissionCategory.procedures);
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
      const { field, method } = admissionHelper.mapper.get(admissionCategory);
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
});
