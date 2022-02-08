import {
  InnerQueueTypes,
  InternalKey,
  NotificationType,
  ObjectBaseType,
  ServiceName,
  generateDispatchId,
} from '../index';
import { v4 } from 'uuid';

export type ObjectCreateTodoType = ObjectBaseType;

export class ObjectCreateTodoClass {
  constructor(readonly objectCreateTodoMock: ObjectCreateTodoType) {}
}

export const generateCreateTodoMEDSMock = ({
  recipientClientId,
  senderClientId,
  todoId,
  correlationId = v4(),
}: {
  recipientClientId: string;
  senderClientId: string;
  todoId: string;
  correlationId?: string;
}): ObjectCreateTodoType => {
  const contentKey = InternalKey.createTodoMEDS;
  return {
    type: InnerQueueTypes.createDispatch,
    dispatchId: generateDispatchId(contentKey, recipientClientId, todoId),
    correlationId,
    serviceName: ServiceName.hepius,
    notificationType: NotificationType.text,
    recipientClientId,
    senderClientId,
    contentKey,
  };
};

export const generateCreateTodoAPPTMock = ({
  recipientClientId,
  senderClientId,
  todoId,
  correlationId = v4(),
}: {
  recipientClientId: string;
  senderClientId: string;
  todoId: string;
  correlationId?: string;
}): ObjectCreateTodoType => {
  const contentKey = InternalKey.createTodoAPPT;
  return {
    type: InnerQueueTypes.createDispatch,
    dispatchId: generateDispatchId(contentKey, recipientClientId, todoId),
    correlationId,
    serviceName: ServiceName.hepius,
    notificationType: NotificationType.text,
    recipientClientId,
    senderClientId,
    contentKey,
  };
};

export const generateCreateTodoTODOMock = ({
  recipientClientId,
  senderClientId,
  todoId,
  correlationId = v4(),
}: {
  recipientClientId: string;
  senderClientId: string;
  todoId: string;
  correlationId?: string;
}): ObjectCreateTodoType => {
  const contentKey = InternalKey.createTodoTODO;
  return {
    type: InnerQueueTypes.createDispatch,
    dispatchId: generateDispatchId(contentKey, recipientClientId, todoId),
    correlationId,
    serviceName: ServiceName.hepius,
    notificationType: NotificationType.text,
    recipientClientId,
    senderClientId,
    contentKey,
  };
};
