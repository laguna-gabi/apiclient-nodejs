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
    'sendBirdChannelUrl' | 'content' | 'journalImageDownloadLink' | 'journalAudioDownloadLink'
  >;

export class ObjectJournalContentClass {
  constructor(readonly objectCustomContentType: ObjectJournalContentType) {}
}

export const generateObjectJournalContentMock = ({
  recipientClientId,
  senderClientId,
  content,
  journalImageDownloadLink,
  journalAudioDownloadLink,
  sendBirdChannelUrl,
}: {
  recipientClientId: string;
  senderClientId: string;
  content: string;
  journalImageDownloadLink?: string;
  journalAudioDownloadLink?: string;
  sendBirdChannelUrl: string;
}): ObjectJournalContentType => {
  const contentKey = CustomKey.journalContent;

  const journalImageDownloadLinkObject = journalImageDownloadLink
    ? { journalImageDownloadLink }
    : {};
  const journalAudioDownloadLinkObject = journalAudioDownloadLink
    ? { journalAudioDownloadLink }
    : {};

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
    ...journalImageDownloadLinkObject,
    ...journalAudioDownloadLinkObject,
  };
};
