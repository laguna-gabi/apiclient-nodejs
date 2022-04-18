import { NotificationType, ServiceName } from '@argus/pandora';
import { v4 } from 'uuid';
import { ObjectBaseType } from '.';
import { ICreateDispatch, InnerQueueTypes, JournalCustomKey, generateDispatchId } from '..';

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
  const contentKey = JournalCustomKey.journalContent;

  const journalImageDownloadLinkObject = journalImageDownloadLink
    ? { journalImageDownloadLink }
    : {};
  const journalAudioDownloadLinkObject = journalAudioDownloadLink
    ? { journalAudioDownloadLink }
    : {};

  return {
    type: InnerQueueTypes.createDispatch,
    dispatchId: generateDispatchId(contentKey, recipientClientId, Date.now().toString()),
    correlationId: v4(),
    serviceName: ServiceName.hepius,
    notificationType: NotificationType.chat,
    recipientClientId,
    senderClientId,
    contentKey,
    content,
    sendBirdChannelUrl,
    ...journalImageDownloadLinkObject,
    ...journalAudioDownloadLinkObject,
  };
};
