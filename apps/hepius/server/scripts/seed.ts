import { generateZipCode } from '@argus/pandora';
import { date, internet, lorem } from 'faker';
import { sign } from 'jsonwebtoken';
import { model } from 'mongoose';
import {
  buildGAD7Questionnaire,
  buildLHPQuestionnaire,
  buildNPSQuestionnaire,
  buildPHQ9Questionnaire,
  buildWHO5Questionnaire,
  createSeedBarriers,
  seedCarePlans,
  seedRedFlags,
} from '../cmd/static';
import {
  BarrierTypeDocument,
  BarrierTypeDto,
  CarePlanTypeDocument,
  CarePlanTypeDto,
  RedFlagType,
  RedFlagTypeDocument,
  RedFlagTypeDto,
} from '../src/care';
import { delay } from '../src/common';
import { UpdateJournalTextParams } from '../src/member';
import { UserService } from '../src/user';
import {
  dbConnect,
  dbDisconnect,
  generateAvailabilityInput,
  generateCreateActionItemParams,
  generateCreateBarrierParamsWizard,
  generateCreateCarePlanParamsWizard,
  generateCreateMemberParams,
  generateCreateRedFlagParamsWizard,
  generateCreateUserParams,
  generateDateOnly,
  generateNotesParams,
  generateOrgParams,
  generateRequestAppointmentParams,
  generateRequestHeaders,
  generateScheduleAppointmentParams,
  generateSetGeneralNotesParams,
  generateSubmitCareWizardParams,
  generateUpdateMemberParams,
} from '../test';
import { Mutations } from '../test/aux';
import { SeedBase } from './seedBase';
import { BarrierType, CarePlanType, Identifier, UserRole } from '@argus/hepiusClient';

/**
 * This is a seed file for initial local db creation.
 * The objects we're creating are:
 * 1. user(1) of type coach
 * 2. user(2) of type nurse
 * 3. user(3) of type coach and nurse
 * 4. organization
 * 5. member in organization above, having user(1) as his primaryCoach,
 *    and user(2), user(3) as his 2ndary users.
 * 6. appointments for member and his users.
 * 7. load assessment templates (questionnaires)
 */

let mutations: Mutations;
let userService: UserService; //used for internal method, isn't exposed on queries

export async function seed() {
  const base = new SeedBase();
  await base.init();
  await dbConnect();
  mutations = base.mutations;
  userService = base.userService;

  const users = await userService.getRegisteredUsers();
  if (users.length === 0) {
    //No users existing in the db, creating one
    await createUser([UserRole.coach], 'user');
    //Since Sendbird is doing async calls in event emitter,
    //we need to wait a while for the actions to be finished since in createMember we're creating
    //a groupChannel that should wait for the user to be registered on sendbird.
    await delay(5000);
  }

  console.debug(
    '\n----------------------------------------------------------------\n' +
      '------------------- Creating an organization -------------------\n' +
      '----------------------------------------------------------------',
  );
  const org = await mutations.createOrg({ orgParams: generateOrgParams() });
  console.log(`${org.id} : organization`);

  console.debug(
    '\n----------------------------------------------------------------\n' +
      '---------------------- Creating a member -----------------------\n' +
      '----------------------------------------------------------------',
  );
  const userId = await userService.getAvailableUser();
  const memberParams = generateCreateMemberParams({
    orgId: org.id,
    email: internet.email(),
    zipCode: generateZipCode(),
    dischargeDate: generateDateOnly(date.future(1)),
    userId: userId.toString(),
  });

  const { id: memberId } = await mutations.createMember({
    memberParams,
  });
  const requestHeaders = generateRequestHeaders(memberParams.authId);
  const { primaryUserId } = await base.queries.getMember({
    id: memberId,
    requestHeaders,
  });
  const updateMemberParams = generateUpdateMemberParams({ ...memberParams, id: memberId });
  const member = await mutations.updateMember({ updateMemberParams });

  console.log(
    `${memberId} : member with deviceId ${member.deviceId}\nhaving` +
      ` primaryUser ${primaryUserId} was registered`,
  );

  console.debug(
    '\n----------------------------------------------------------------\n' +
      '---------------- Pending sendbird registration -----------------\n' +
      '----------------------------------------------------------------',
  );
  //Since Sendbird is doing async calls in event emitter,
  //we need to wait a while for the register of group chat to be finished.
  await delay(4000);

  const signed = sign({ username: member.deviceId, sub: member.authId }, 'key-123');

  console.debug(
    `If you wish to call getMember this header should be added:\n` +
      `    "Authorization" : "Bearer ${signed}"\n` +
      `    like so : https://ibb.co/TmhMbDL [not a virus, don't worry]`,
  );

  console.debug(
    '\n----------------------------------------------------------------\n' +
      '---------- Creating 3 availabilities for primaryUserId ---------\n' +
      '----------------------------------------------------------------',
  );
  const availabilities = [
    generateAvailabilityInput(),
    generateAvailabilityInput(),
    generateAvailabilityInput(),
  ];
  await base.mutations.createAvailabilities({ availabilities });

  console.debug(
    '\n----------------------------------------------------------------\n' +
      '-------- Scheduling appointments with users and member ---------\n' +
      '----------------------------------------------------------------',
  );
  await requestAppointment(memberId, primaryUserId.toString());
  const appointmentId = await scheduleAppointment(memberId, primaryUserId.toString());
  await delay(2000); //pending sendbird post events actions
  await endAppointment(appointmentId);
  await delay(2000); //pending sendbird post events actions
  await scheduleAppointment(memberId, primaryUserId.toString());
  await delay(2000); //pending sendbird post events actions

  console.debug(
    '\n----------------------------------------------------------------\n' +
      '--------------- Create action items for a member ---------------\n' +
      '----------------------------------------------------------------',
  );
  await createActionItem(memberId);
  await createActionItem(memberId);

  console.debug(
    '\n----------------------------------------------------------------\n' +
      '---------------- Set general notes for a member ----------------\n' +
      '----------------------------------------------------------------',
  );
  await setGeneralNotes(memberId);

  console.debug(
    '\n----------------------------------------------------------------\n' +
      '------------------- create member journal ----------------------\n' +
      '----------------------------------------------------------------',
  );
  const { id: journalId } = await base.mutations.createJournal({ requestHeaders });

  const updateJournalTextParams: UpdateJournalTextParams = {
    id: journalId,
    text: lorem.word(),
  };
  await base.mutations.updateJournalText({ requestHeaders, updateJournalTextParams });

  console.debug(
    '\n----------------------------------------------------------------\n' +
      '---------- load assessment templates (questionnaires) ----------\n' +
      '----------------------------------------------------------------',
  );
  // GAD-7
  await base.questionnaireService.createQuestionnaire(buildGAD7Questionnaire());
  // PHQ-9
  await base.questionnaireService.createQuestionnaire(buildPHQ9Questionnaire());
  // WHO-5
  await base.questionnaireService.createQuestionnaire(buildWHO5Questionnaire());
  // NPS
  await base.questionnaireService.createQuestionnaire(buildNPSQuestionnaire());
  await base.questionnaireService.createQuestionnaire(buildLHPQuestionnaire());

  console.debug(
    '\n----------------------------------------------------------------\n' +
      '------------------- create care plan types ---------------------\n' +
      '----------------------------------------------------------------',
  );
  const carePlanTypeModel = model<CarePlanTypeDocument>(CarePlanType.name, CarePlanTypeDto);
  await carePlanTypeModel.insertMany(seedCarePlans);

  console.debug(
    '\n----------------------------------------------------------------\n' +
      '------------------- create barrier types ---------------------\n' +
      '----------------------------------------------------------------',
  );
  // has to be after the creation if care plan types!!

  const barrierTypeModel = model<BarrierTypeDocument>(BarrierType.name, BarrierTypeDto);
  await createSeedBarriers(barrierTypeModel, carePlanTypeModel);

  console.debug(
    '\n----------------------------------------------------------------\n' +
      '------------------- create red flag types ---------------------\n' +
      '----------------------------------------------------------------',
  );
  const redFlagTypeModel = model<RedFlagTypeDocument>(RedFlagType.name, RedFlagTypeDto);
  await redFlagTypeModel.insertMany(seedRedFlags);

  console.debug(
    '\n----------------------------------------------------------------\n' +
      '----------- create red flag, barrier and care plan ---------------\n' +
      '----------------------------------------------------------------',
  );

  const carePlanTypes = await base.queries.getCarePlanTypes();
  const barrierTypes = await base.queries.getBarrierTypes();
  const redFlagTypes = await base.queries.getRedFlagTypes();
  const randomCarePlanType = carePlanTypes[Math.floor(Math.random() * carePlanTypes.length)];
  const randomBarrierType = barrierTypes[Math.floor(Math.random() * barrierTypes.length)];
  const randomRedFlagType = redFlagTypes[Math.floor(Math.random() * redFlagTypes.length)];

  const carePlan = generateCreateCarePlanParamsWizard({ type: { id: randomCarePlanType.id } });
  const barrier = generateCreateBarrierParamsWizard({
    type: randomBarrierType.id,
    carePlans: [carePlan],
  });
  const redFlag = generateCreateRedFlagParamsWizard({
    barriers: [barrier],
    type: randomRedFlagType.id,
  });
  const wizardParams = generateSubmitCareWizardParams({ redFlag, memberId });
  await base.mutations.submitCareWizard({
    submitCareWizardParams: wizardParams,
  });

  await base.cleanUp();
  await dbDisconnect();
}

/**************************************************************************************************
 **************************************** Internal methods ****************************************
 *************************************************************************************************/

const createUser = async (roles: UserRole[], userText: string): Promise<Identifier> => {
  const user = await mutations.createUser({
    createUserParams: generateCreateUserParams({
      roles,
    }),
  });
  const token = sign({ username: user.id, sub: user.authId }, 'key-123');
  console.log(`${user.id} : ${userText} of type ${roles} - valid token: ${token}`);

  return { id: user.id };
};

const requestAppointment = async (memberId: string, userId: string) => {
  const appointment = await mutations.requestAppointment({
    appointmentParams: generateRequestAppointmentParams({
      memberId,
      userId,
    }),
  });
  console.log(`${appointment.id} : request appointment for member and primaryUser`);
};

const scheduleAppointment = async (memberId: string, userId: string): Promise<string> => {
  const appointment = await mutations.scheduleAppointment({
    appointmentParams: generateScheduleAppointmentParams({
      memberId,
      userId,
    }),
  });
  console.log(`${appointment.id} : scheduled appointment for member and primaryUser`);

  return appointment.id;
};

const endAppointment = async (id: string) => {
  await mutations.endAppointment({
    endAppointmentParams: { id, notes: generateNotesParams() },
  });
  console.log(`${id} : end appointment with notes and scores`);
};

const setGeneralNotes = async (memberId: string) => {
  const setGeneralNotesParams = generateSetGeneralNotesParams({ memberId });
  await mutations.setGeneralNotes({ setGeneralNotesParams });
};

const createActionItem = async (memberId: string) => {
  const createActionItemParams = generateCreateActionItemParams({ memberId });
  const { id } = await mutations.createActionItem({ createActionItemParams });
  console.log(`${id} : created an action item '${createActionItemParams.title}' for member`);
};
