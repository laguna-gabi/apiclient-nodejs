import { v4 } from 'uuid';
import {
  CustomKey,
  ICreateDispatch,
  InnerQueueTypes,
  InternalNotificationType,
  ObjectBaseType,
  ServiceName,
  generateDispatchId,
} from '../index';

export type ObjectJournalContentType = ObjectBaseType &
  Pick<
    ICreateDispatch,
    'journalImageDownloadLink' | 'journalAudioDownloadLink' | 'sendBirdChannelUrl' | 'content'
  >;

export class ObjectJournalContentClass {
  constructor(readonly objectCustomContentType: ObjectJournalContentType) {}
}

export const generateObjectJournalContentMock = ({
  recipientClientId,
  senderClientId,
  content,
  sendBirdChannelUrl,
  journalImageDownloadLink,
  journalAudioDownloadLink,
}: {
  recipientClientId: string;
  senderClientId: string;
  content: string;
  sendBirdChannelUrl: string;
  journalImageDownloadLink: string;
  journalAudioDownloadLink: string;
}): ObjectJournalContentType => {
  const contentKey = CustomKey.journalContent;
  return {
    type: InnerQueueTypes.createDispatch,
    dispatchId: generateDispatchId(
      CustomKey.journalContent,
      recipientClientId,
      Date.now().toString(),
    ),
    correlationId: v4(),
    serviceName: ServiceName.hepius,
    notificationType: InternalNotificationType.chatMessageJournal,
    recipientClientId,
    senderClientId,
    contentKey,
    content,
    sendBirdChannelUrl,
    journalImageDownloadLink,
    journalAudioDownloadLink,
  };
};
