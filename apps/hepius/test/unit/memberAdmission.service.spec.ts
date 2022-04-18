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
  generateId,
  generateProcedureParams,
} from '../index';

describe(MemberAdmissionService.name, () => {
  let module: TestingModule;
  let service: MemberAdmissionService;
  let procedureModel: Model<ProcedureDocument & defaultTimestampsDbValues>;

  beforeAll(async () => {
    mockProcessWarnings(); // to hide pino prettyPrint warning
    module = await Test.createTestingModule({
      imports: defaultModules().concat(MemberModule),
    }).compile();

    service = module.get<MemberAdmissionService>(MemberAdmissionService);
    mockLogger(module.get<LoggerService>(LoggerService));

    procedureModel = model<ProcedureDocument & defaultTimestampsDbValues>(
      Procedure.name,
      ProcedureDto,
    );

    await dbConnect();
  });

  afterAll(async () => {
    await module.close();
    await dbDisconnect();
  });

  describe('changeAdmission', () => {
    describe('procedure', () => {
      it('should create 2 procedures for a member, and 1 procedure for other member', async () => {
        const memberId1 = generateId();
        const procedure1a = generateProcedureParams({ changeType: ChangeType.create });
        const procedure1b = generateProcedureParams({ changeType: ChangeType.create });
        await service.changeAdmission({ procedure: procedure1a }, memberId1);
        const result1 = await service.changeAdmission({ procedure: procedure1b }, memberId1);

        const memberId2 = generateId();
        const procedure2 = generateProcedureParams({ changeType: ChangeType.create });
        const result2 = await service.changeAdmission({ procedure: procedure2 }, memberId2);

        const { _id: procedureId1a } = await procedureModel.findOne(
          { date: procedure1a.date },
          { _id: 1 },
        );
        const { _id: procedureId1b } = await procedureModel.findOne(
          { date: procedure1b.date },
          { _id: 1 },
        );
        const { _id: procedureId2 } = await procedureModel.findOne(
          { date: procedure2.date },
          { _id: 1 },
        );

        expect(result1).toMatchObject({
          memberId: new Types.ObjectId(memberId1),
          procedures: [new Types.ObjectId(procedureId1a), new Types.ObjectId(procedureId1b)],
        });
        expect(result2).toMatchObject({
          memberId: new Types.ObjectId(memberId2),
          procedures: [new Types.ObjectId(procedureId2)],
        });
      });

      it('should create and update a member procedure', async () => {
        const memberId = generateId();
        const procedure = generateProcedureParams({ changeType: ChangeType.create });

        const result = await service.changeAdmission({ procedure }, memberId);

        const procedure1Update = generateProcedureParams({
          changeType: ChangeType.update,
          id: result.procedures[0].id,
        });

        await service.changeAdmission({ procedure: procedure1Update }, memberId);

        const updatedProcedureResult: Procedure = await procedureModel.findById(
          new Types.ObjectId(procedure1Update.id),
          { updatedAt: 0, createdAt: 0, _id: 0, deleted: 0 },
        );

        expect(updatedProcedureResult.date).toEqual(procedure1Update.date);
        expect(updatedProcedureResult.procedureType).toEqual(procedure1Update.procedureType);
        expect(updatedProcedureResult.text).toEqual(procedure1Update.text);

        expect(result).toMatchObject({
          memberId: new Types.ObjectId(memberId),
          procedures: [new Types.ObjectId(updatedProcedureResult.id)],
        });
      });

      it('should create and delete a member procedure', async () => {
        const memberId = generateId();
        const procedure = generateProcedureParams({ changeType: ChangeType.create });

        await service.changeAdmission({ procedure }, memberId);

        const { _id: procedureId } = await procedureModel.findOne(
          { date: procedure.date },
          { _id: 1 },
        );

        const result = await service.changeAdmission(
          { procedure: { changeType: ChangeType.delete, id: procedureId } },
          memberId,
        );

        expect(result).toMatchObject({ memberId: new Types.ObjectId(memberId), procedures: [] });
      });

      it('should throw error on update procedure with id not found', async () => {
        const memberId = generateId();
        const procedure = generateProcedureParams({
          changeType: ChangeType.update,
          id: generateId(),
        });
        await expect(service.changeAdmission({ procedure }, memberId)).rejects.toThrow(
          Errors.get(ErrorType.memberAdmissionProcedureIdNotFound),
        );
      });

      it('should throw error on delete procedure with id not found', async () => {
        const memberId = generateId();
        const procedure = generateProcedureParams({
          changeType: ChangeType.delete,
          id: generateId(),
        });
        await expect(service.changeAdmission({ procedure }, memberId)).rejects.toThrow(
          Errors.get(ErrorType.memberAdmissionProcedureIdNotFound),
        );
      });

      it('should remove null fields from create procedure params', async () => {
        const memberId = generateId();
        const procedure = generateProcedureParams({ changeType: ChangeType.create });
        procedure.text = null;

        await service.changeAdmission({ procedure }, memberId);

        const procedureRes = await procedureModel.findOne({ date: procedure.date });
        expect(procedureRes.text).not.toBeDefined();
      });

      it('should not override procedure null input field on update', async () => {
        const memberId = generateId();
        const createProcedure = generateProcedureParams({ changeType: ChangeType.create });

        const admission = await service.changeAdmission({ procedure: createProcedure }, memberId);

        const updateProcedure = generateProcedureParams({
          changeType: ChangeType.update,
          id: admission.procedures[0].id,
        });
        updateProcedure.text = null;

        await service.changeAdmission({ procedure: updateProcedure }, memberId);

        const procedureRes = await procedureModel.findById(
          new Types.ObjectId(admission.procedures[0].id),
        );
        expect(procedureRes.text).toEqual(createProcedure.text);
      });
    });
  });
});
