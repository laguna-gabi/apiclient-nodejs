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
  AdmissionCategory,
  ExternalAppointment,
  ExternalAppointmentDocument,
  ExternalAppointmentDto,
  Medication,
  MedicationDocument,
  MedicationDto,
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
  generateAdmissionExternalAppointmentParams,
  generateId,
  generateMedicationParams,
  generateProcedureParams,
} from '../index';

describe(MemberAdmissionService.name, () => {
  let module: TestingModule;
  let service: MemberAdmissionService;
  let procedureModel: Model<ProcedureDocument & defaultTimestampsDbValues>;
  let medicationModel: Model<MedicationDocument & defaultTimestampsDbValues>;
  let externalAppointmentModel: Model<ExternalAppointmentDocument & defaultTimestampsDbValues>;

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
    medicationModel = model<MedicationDocument & defaultTimestampsDbValues>(
      Medication.name,
      MedicationDto,
    );
    externalAppointmentModel = model<ExternalAppointmentDocument & defaultTimestampsDbValues>(
      ExternalAppointment.name,
      ExternalAppointmentDto,
    );

    await dbConnect();
  });

  afterAll(async () => {
    await module.close();
    await dbDisconnect();
  });

  describe('changeAdmission', () => {
    describe(AdmissionCategory.procedures, () => {
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

    describe(AdmissionCategory.medications, () => {
      // eslint-disable-next-line max-len
      it('should create 2 medications for a member, and 1 medication for other member', async () => {
        const memberId1 = generateId();
        const medication1a = generateMedicationParams({ changeType: ChangeType.create });
        const medication1b = generateMedicationParams({ changeType: ChangeType.create });
        await service.changeAdmission({ medication: medication1a }, memberId1);
        const result1 = await service.changeAdmission({ medication: medication1b }, memberId1);

        const memberId2 = generateId();
        const medication2 = generateMedicationParams({ changeType: ChangeType.create });
        const result2 = await service.changeAdmission({ medication: medication2 }, memberId2);

        const { _id: medicationId1a } = await medicationModel.findOne(
          { startDate: medication1a.startDate },
          { _id: 1 },
        );
        const { _id: medicationId1b } = await medicationModel.findOne(
          { startDate: medication1b.startDate },
          { _id: 1 },
        );
        const { _id: medicationId2 } = await medicationModel.findOne(
          { startDate: medication1b.startDate },
          { _id: 1 },
        );

        expect(result1).toMatchObject({
          memberId: new Types.ObjectId(memberId1),
          medications: [new Types.ObjectId(medicationId1a), new Types.ObjectId(medicationId1b)],
        });
        expect(result2).toMatchObject({
          memberId: new Types.ObjectId(memberId2),
          medications: [new Types.ObjectId(medicationId2)],
        });
      });

      it('should create and update a member medication', async () => {
        const memberId = generateId();
        const medication = generateMedicationParams({ changeType: ChangeType.create });

        const result = await service.changeAdmission({ medication }, memberId);

        const medication1Update = generateMedicationParams({
          changeType: ChangeType.update,
          id: result.medications[0].id,
        });

        await service.changeAdmission({ medication: medication1Update }, memberId);

        const updatedMedicationResult: Medication = await medicationModel.findById(
          new Types.ObjectId(medication1Update.id),
          { updatedAt: 0, createdAt: 0, _id: 0, deleted: 0 },
        );

        expect(updatedMedicationResult.name).toEqual(medication1Update.name);
        expect(updatedMedicationResult.frequency).toEqual(medication1Update.frequency);
        expect(updatedMedicationResult.type).toEqual(medication1Update.type);
        expect(updatedMedicationResult.amount).toMatchObject(medication1Update.amount);
        expect(updatedMedicationResult.startDate).toEqual(medication1Update.startDate);
        expect(updatedMedicationResult.endDate).toEqual(medication1Update.endDate);
        expect(updatedMedicationResult.memberNote).toEqual(medication1Update.memberNote);
        expect(updatedMedicationResult.coachNote).toEqual(medication1Update.coachNote);

        expect(result).toMatchObject({
          memberId: new Types.ObjectId(memberId),
          medications: [new Types.ObjectId(updatedMedicationResult.id)],
        });
      });

      it('should create and delete a member medication', async () => {
        const memberId = generateId();
        const medication = generateMedicationParams({ changeType: ChangeType.create });

        await service.changeAdmission({ medication }, memberId);

        const { _id: medicationId } = await medicationModel.findOne(
          { startDate: medication.startDate },
          { _id: 1 },
        );

        const result = await service.changeAdmission(
          { medication: { changeType: ChangeType.delete, id: medicationId } },
          memberId,
        );

        expect(result).toMatchObject({ memberId: new Types.ObjectId(memberId), medications: [] });
      });

      it('should throw error on update medication with id not found', async () => {
        const memberId = generateId();
        const medication = generateMedicationParams({
          changeType: ChangeType.update,
          id: generateId(),
        });
        await expect(service.changeAdmission({ medication }, memberId)).rejects.toThrow(
          Errors.get(ErrorType.memberAdmissionMedicationIdNotFound),
        );
      });

      it('should throw error on delete procedure with id not found', async () => {
        const memberId = generateId();
        const medication = generateMedicationParams({
          changeType: ChangeType.delete,
          id: generateId(),
        });
        await expect(service.changeAdmission({ medication }, memberId)).rejects.toThrow(
          Errors.get(ErrorType.memberAdmissionMedicationIdNotFound),
        );
      });

      it('should remove null fields from create medication params', async () => {
        const memberId = generateId();
        const medication = generateMedicationParams({ changeType: ChangeType.create });
        medication.name = null;

        await service.changeAdmission({ medication }, memberId);

        const medicationRes = await medicationModel.findOne({ startDate: medication.startDate });
        expect(medicationRes.name).not.toBeDefined();
      });

      it('should not override medication null input field on update', async () => {
        const memberId = generateId();
        const createMedication = generateMedicationParams({ changeType: ChangeType.create });

        const admission = await service.changeAdmission({ medication: createMedication }, memberId);

        const updateMedication = generateMedicationParams({
          changeType: ChangeType.update,
          id: admission.medications[0].id,
        });
        updateMedication.name = null;

        await service.changeAdmission({ medication: updateMedication }, memberId);

        const medicationRes = await medicationModel.findById(
          new Types.ObjectId(admission.medications[0].id),
        );
        expect(medicationRes.name).toEqual(createMedication.name);
      });
    });

    describe(AdmissionCategory.externalAppointments, () => {
      // eslint-disable-next-line max-len
      it('should create 2 externalAppointment for a member, and 1 externalAppointment for other member', async () => {
        const memberId1 = generateId();
        const external1a = generateAdmissionExternalAppointmentParams({
          changeType: ChangeType.create,
        });
        const external1b = generateAdmissionExternalAppointmentParams({
          changeType: ChangeType.create,
        });
        await service.changeAdmission({ externalAppointment: external1a }, memberId1);
        const result1 = await service.changeAdmission(
          { externalAppointment: external1b },
          memberId1,
        );

        const memberId2 = generateId();
        const external2 = generateAdmissionExternalAppointmentParams({
          changeType: ChangeType.create,
        });
        const result2 = await service.changeAdmission(
          { externalAppointment: external2 },
          memberId2,
        );

        const { _id: externalId1a } = await externalAppointmentModel.findOne(
          { date: external1a.date },
          { _id: 1 },
        );
        const { _id: externalId1b } = await externalAppointmentModel.findOne(
          { date: external1b.date },
          { _id: 1 },
        );
        const { _id: externalId2 } = await externalAppointmentModel.findOne(
          { date: external2.date },
          { _id: 1 },
        );

        expect(result1).toMatchObject({
          memberId: new Types.ObjectId(memberId1),
          externalAppointments: [
            new Types.ObjectId(externalId1a),
            new Types.ObjectId(externalId1b),
          ],
        });
        expect(result2).toMatchObject({
          memberId: new Types.ObjectId(memberId2),
          externalAppointments: [new Types.ObjectId(externalId2)],
        });
      });

      it('should create and update a member externalAppointment', async () => {
        const memberId = generateId();
        const externalAppointment = generateAdmissionExternalAppointmentParams({
          changeType: ChangeType.create,
        });

        const result = await service.changeAdmission({ externalAppointment }, memberId);

        const external1Update = generateAdmissionExternalAppointmentParams({
          changeType: ChangeType.update,
          id: result.externalAppointments[0].id,
          isScheduled: !externalAppointment.isScheduled,
        });

        await service.changeAdmission({ externalAppointment: external1Update }, memberId);

        const updatedExternalResult: ExternalAppointment = await externalAppointmentModel.findById(
          new Types.ObjectId(external1Update.id),
          {
            updatedAt: 0,
            createdAt: 0,
            _id: 0,
            deleted: 0,
          },
        );

        expect(updatedExternalResult.isScheduled).toEqual(external1Update.isScheduled);
        expect(updatedExternalResult.drName).toEqual(external1Update.drName);
        expect(updatedExternalResult.instituteOrHospitalName).toEqual(
          external1Update.instituteOrHospitalName,
        );
        expect(updatedExternalResult.date).toEqual(external1Update.date);
        expect(updatedExternalResult.phone).toEqual(external1Update.phone);
        expect(updatedExternalResult.description).toEqual(external1Update.description);
        expect(updatedExternalResult.address).toEqual(external1Update.address);

        expect(result).toMatchObject({
          memberId: new Types.ObjectId(memberId),
          externalAppointments: [new Types.ObjectId(updatedExternalResult.id)],
        });
      });

      it('should create and delete a member externalAppointment', async () => {
        const memberId = generateId();
        const externalAppointment = generateAdmissionExternalAppointmentParams({
          changeType: ChangeType.create,
        });

        await service.changeAdmission({ externalAppointment }, memberId);

        const { _id: extrenalId } = await externalAppointmentModel.findOne(
          { date: externalAppointment.date },
          { _id: 1 },
        );

        const result = await service.changeAdmission(
          { externalAppointment: { changeType: ChangeType.delete, id: extrenalId } },
          memberId,
        );

        expect(result).toMatchObject({
          memberId: new Types.ObjectId(memberId),
          externalAppointments: [],
        });
      });

      // eslint-disable-next-line max-len
      it('should throw error on update externalAppointment with id not found', async () => {
        const memberId = generateId();
        const externalAppointment = generateAdmissionExternalAppointmentParams({
          changeType: ChangeType.update,
          id: generateId(),
        });
        await expect(service.changeAdmission({ externalAppointment }, memberId)).rejects.toThrow(
          Errors.get(ErrorType.memberAdmissionExternalAppointmentIdNotFound),
        );
      });

      // eslint-disable-next-line max-len
      it('should throw error on delete externalAppointment with id not found', async () => {
        const memberId = generateId();
        const externalAppointment = generateAdmissionExternalAppointmentParams({
          changeType: ChangeType.delete,
          id: generateId(),
        });
        await expect(service.changeAdmission({ externalAppointment }, memberId)).rejects.toThrow(
          Errors.get(ErrorType.memberAdmissionExternalAppointmentIdNotFound),
        );
      });

      it('should remove null fields from create externalAppointment params', async () => {
        const memberId = generateId();
        const externalAppointment = generateAdmissionExternalAppointmentParams({
          changeType: ChangeType.create,
        });
        externalAppointment.address = null;

        await service.changeAdmission({ externalAppointment }, memberId);

        const externalAppointmentRes = await externalAppointmentModel.findOne({
          address: externalAppointment.address,
        });
        expect(externalAppointmentRes.address).not.toBeDefined();
      });

      // eslint-disable-next-line max-len
      it('should not override externalAppointment null input field on update', async () => {
        const memberId = generateId();
        const createExternal = generateAdmissionExternalAppointmentParams({
          changeType: ChangeType.create,
        });

        const admission = await service.changeAdmission(
          { externalAppointment: createExternal },
          memberId,
        );

        const updateExternal = generateAdmissionExternalAppointmentParams({
          changeType: ChangeType.update,
          id: admission.externalAppointments[0].id,
        });
        updateExternal.address = null;

        await service.changeAdmission({ externalAppointment: updateExternal }, memberId);

        const externalRes = await externalAppointmentModel.findById(
          new Types.ObjectId(admission.externalAppointments[0].id),
        );
        expect(externalRes.address).toEqual(createExternal.address);
      });

      it('should set default isScheduled to true when not in input params', async () => {
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
    });
  });
});
