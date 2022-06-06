import { generateId, mockLogger, mockProcessWarnings } from '@argus/pandora';
import { Test, TestingModule } from '@nestjs/testing';
import { isNil, omitBy } from 'lodash';
import { Model, Types, model } from 'mongoose';
import {
  checkDelete,
  dbConnect,
  dbDisconnect,
  defaultModules,
  generateUpdateRecordingParams,
  generateUpdateRecordingReviewParams,
} from '..';
import { ErrorType, Errors, LoggerService, RecordingType } from '../../src/common';
import {
  Recording,
  RecordingDocument,
  RecordingDto,
  RecordingModule,
  RecordingService,
} from '../../src/recording';

describe('MemberService', () => {
  let module: TestingModule;
  let service: RecordingService;

  let recordingModel: Model<RecordingDocument>;

  beforeAll(async () => {
    mockProcessWarnings(); // to hide pino prettyPrint warning
    module = await Test.createTestingModule({
      imports: defaultModules().concat(RecordingModule),
    }).compile();

    service = module.get<RecordingService>(RecordingService);
    mockLogger(module.get<LoggerService>(LoggerService));

    recordingModel = model<RecordingDocument>(Recording.name, RecordingDto);

    await dbConnect();
  });

  afterAll(async () => {
    await module.close();
    await dbDisconnect();
  });

  describe('updateRecording + getRecordings', () => {
    it('should fail to update an existing id for different member', async () => {
      const memberId1 = generateId();
      const userId = generateId();
      const journeyId = generateId();
      const params1 = generateUpdateRecordingParams({ memberId: memberId1, userId, journeyId });

      const recording1 = await service.updateRecording(params1);

      const memberId2 = generateId();
      const params2 = generateUpdateRecordingParams({
        id: recording1.id,
        memberId: memberId2,
        userId,
        journeyId,
      });

      await expect(service.updateRecording(params2)).rejects.toThrow(
        Errors.get(ErrorType.recordingSameUserEdit),
      );
    });

    it('should insert recording if id does not exist', async () => {
      const memberId = generateId();
      const journeyId = generateId();
      const params = generateUpdateRecordingParams({ memberId, journeyId });
      const result = await service.updateRecording(params);
      expect(result).toEqual(
        expect.objectContaining(
          omitBy(
            {
              ...params,
              memberId: new Types.ObjectId(params.memberId),
              userId: new Types.ObjectId(params.userId),
              journeyId: new Types.ObjectId(params.journeyId),
              appointmentId: new Types.ObjectId(params.appointmentId),
            },
            isNil,
          ),
        ),
      );
    });

    it('should create a member recording with undefined id on 1st time', async () => {
      const memberId = generateId();
      const journeyId = generateId();
      const params = generateUpdateRecordingParams({ memberId, journeyId });
      delete params.id;
      const result = await service.updateRecording(params);
      expect(result).toEqual(
        expect.objectContaining(
          omitBy(
            {
              ...params,
              memberId: new Types.ObjectId(params.memberId),
              userId: new Types.ObjectId(params.userId),
              journeyId: new Types.ObjectId(params.journeyId),
              appointmentId: new Types.ObjectId(params.appointmentId),
            },
            isNil,
          ),
        ),
      );
    });

    it('should update a member recording', async () => {
      const memberId = generateId();
      const journeyId = generateId();
      const params = generateUpdateRecordingParams({ memberId, journeyId });
      const recording = await service.updateRecording(params);

      const recordings = await service.getRecordings({ memberId, journeyId });

      expect(recordings.length).toEqual(1);
      expect(recordings[0].id).toEqual(recording.id);
      expect(recordings[0]).toEqual(
        expect.objectContaining(
          omitBy(
            {
              ...params,
              memberId: new Types.ObjectId(params.memberId),
              userId: new Types.ObjectId(params.userId),
              journeyId: new Types.ObjectId(params.journeyId),
              appointmentId: new Types.ObjectId(params.appointmentId),
            },
            isNil,
          ),
        ),
      );
    });

    test.each(['start', 'end', 'phone', 'answered', 'recordingType', 'appointmentId'])(
      'should not override optional field %p when not set from params',
      async (param) => {
        const memberId = generateId();
        const userId = generateId();
        const journeyId = generateId();
        const params1 = generateUpdateRecordingParams({
          memberId,
          appointmentId: generateId(),
          recordingType: RecordingType.phone,
          journeyId,
          userId,
        });
        const { id } = await service.updateRecording(params1);
        const params2 = generateUpdateRecordingParams({ id, memberId, userId, journeyId });
        delete params2[param];
        await service.updateRecording(params2);

        const recordings = await service.getRecordings({ memberId, journeyId });
        expect(recordings.length).toEqual(1);
        expect(recordings[0][param]).toEqual(
          param === 'appointmentId' ? new Types.ObjectId(params1[param]) : params1[param],
        );
      },
    );
  });

  describe('updateRecordingReview', () => {
    it('should fail to update review on non existing member', async () => {
      await expect(
        service.updateRecordingReview(generateUpdateRecordingReviewParams()),
      ).rejects.toThrow(Errors.get(ErrorType.recordingNotFound));
    });

    it('should fail to update review if user created recording', async () => {
      const memberId = generateId();
      const journeyId = generateId();
      const userId = generateId();
      const params = generateUpdateRecordingParams({ memberId, journeyId, userId });
      const recording = await service.updateRecording(params);

      const updateRecordingReviewParams = generateUpdateRecordingReviewParams({
        recordingId: recording.id,
        userId,
      });
      await expect(service.updateRecordingReview(updateRecordingReviewParams)).rejects.toThrow(
        Errors.get(ErrorType.recordingSameUser),
      );
    });

    it('should create a review', async () => {
      const memberId = generateId();
      const journeyId = generateId();
      const params = generateUpdateRecordingParams({ memberId, journeyId });
      const recording = await service.updateRecording(params);

      const paramsReview = generateUpdateRecordingReviewParams({ recordingId: recording.id });
      await service.updateRecordingReview(paramsReview);

      const recordings = await service.getRecordings({ memberId, journeyId });
      const { review } = recordings[0];

      expect(review.content).toEqual(paramsReview.content);
      expect(review.userId.toString()).toEqual(paramsReview.userId);
      expect(review.createdAt).toEqual(review.updatedAt);
    });
  });

  describe('deleteMemberRecording', () => {
    it('should be able to hard delete after soft delete', async () => {
      const memberId = await generateId();
      const userId = generateId();
      const { id: recordingId } = await service.updateRecording(
        generateUpdateRecordingParams({ memberId, userId }),
      );

      await service.deleteMemberRecording({ memberId, deletedBy: userId, hard: false });

      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      const recordingDeletedResult = await recordingModel.findWithDeleted({
        memberId: new Types.ObjectId(memberId),
      });
      await checkDelete(recordingDeletedResult, { memberId: new Types.ObjectId(memberId) }, userId);

      await service.deleteMemberRecording({ memberId, deletedBy: userId, hard: true });

      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      const recordingDeletedResultHard = await recordingModel.findWithDeleted({ id: recordingId });
      expect(recordingDeletedResultHard).toEqual([]);
    });
  });
});
