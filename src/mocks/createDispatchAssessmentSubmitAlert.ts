import {
  AlertInternalKey,
  ICreateDispatch,
  InnerQueueTypes,
  NotificationType,
  ObjectBaseType,
  ServiceName,
  generateDispatchId,
} from '../index';
import { v4 } from 'uuid';

export type ObjectAssessmentSubmitAlertType = ObjectBaseType &
  Pick<ICreateDispatch, 'assessmentName' | 'assessmentScore'>;

export class ObjectAssessmentSubmitAlertClass {
  constructor(readonly objectAssessmentSubmitAlertMock: ObjectAssessmentSubmitAlertType) {}
}

export const generateAssessmentSubmitAlertMock = ({
  recipientClientId,
  senderClientId,
  assessmentName,
  assessmentScore,
  assessmentId,
  correlationId = v4(),
}: {
  recipientClientId: string;
  senderClientId: string;
  assessmentName: string;
  assessmentScore: string;
  assessmentId: string;
  correlationId?: string;
}): ObjectAssessmentSubmitAlertType => {
  const contentKey = AlertInternalKey.assessmentSubmitAlert;
  return {
    type: InnerQueueTypes.createDispatch,
    dispatchId: generateDispatchId(contentKey, assessmentId),
    correlationId,
    serviceName: ServiceName.hepius,
    notificationType: NotificationType.textSms,
    recipientClientId,
    senderClientId,
    assessmentName,
    assessmentScore,
    contentKey,
  };
};
