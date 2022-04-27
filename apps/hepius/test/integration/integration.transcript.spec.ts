import { QueueType } from '@argus/pandora';
import { ObjectCreateTranscriptClass, generateCreateTranscriptMock } from '@argus/poseidonClient';
import { BEFORE_ALL_TIMEOUT, generateId, generateRequestHeaders } from '..';
import { delay } from '../../src/common';
import { AppointmentsIntegrationActions, Creators, Handler } from '../aux';

// mock uuid.v4:
jest.mock('uuid', () => {
  const actualUUID = jest.requireActual('uuid');
  const mockV4 = jest.fn(actualUUID.v4);
  return { v4: mockV4 };
});

describe('Integration tests: transcripts', () => {
  const handler: Handler = new Handler();
  let creators: Creators;
  let appointmentsActions: AppointmentsIntegrationActions;

  beforeAll(async () => {
    await handler.beforeAll();
    appointmentsActions = new AppointmentsIntegrationActions(
      handler.mutations,
      handler.defaultUserRequestHeaders,
    );
    creators = new Creators(handler, appointmentsActions);
    handler.queueService.spyOnQueueServiceSendMessage.mockReset(); //not interested in past events
  }, BEFORE_ALL_TIMEOUT);

  afterEach(() => {
    handler.queueService.spyOnQueueServiceSendMessage.mockReset();
  });

  afterAll(async () => {
    await handler.afterAll();
  });

  describe('createTranscript', () => {
    it('should send createTranscript after completeMultipartUpload', async () => {
      const { member, user } = await creators.createMemberUserAndOptionalOrg();
      const requestHeaders = generateRequestHeaders(user.authId);
      const recordingId = generateId();
      await delay(200);

      const { uploadId } = await handler.queries.getMemberMultipartUploadRecordingLink({
        multipartUploadRecordingLinkParams: {
          id: recordingId,
          memberId: member.id,
          partNumber: 1,
        },
      });

      handler.queueService.spyOnQueueServiceSendMessage.mockReset(); //not interested in past events

      await handler.mutations.completeMultipartUpload({
        completeMultipartUploadParams: {
          id: recordingId,
          memberId: member.id,
          uploadId,
        },
        requestHeaders,
      });

      const createTranscriptMock = generateCreateTranscriptMock({
        recordingId,
        memberId: member.id,
        userId: user.id,
      });
      const createTranscriptObject = new ObjectCreateTranscriptClass(createTranscriptMock);
      Object.keys(createTranscriptObject.objectCreateTranscript).forEach((key) => {
        expect(handler.queueService.spyOnQueueServiceSendMessage).toHaveBeenCalledWith(
          expect.objectContaining({
            type: QueueType.transcript,
            message: expect.stringContaining(
              key === 'correlationId' ? key : `"${key}":"${createTranscriptMock[key]}"`,
            ),
          }),
        );
      });
    });
  });
});
