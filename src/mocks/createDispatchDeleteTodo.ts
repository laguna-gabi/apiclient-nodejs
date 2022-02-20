import {
  InnerQueueTypes,
  NotificationType,
  ObjectBaseType,
  ServiceName,
  TodoInternalKey,
  generateDispatchId,
} from '../index';
import { v4 } from 'uuid';

export type ObjectDeleteTodoType = ObjectBaseType;

export class ObjectDeleteTodoClass {
  constructor(readonly objectDeleteTodoMock: ObjectDeleteTodoType) {}
}

export const generateDeleteTodoMEDSMock = ({
  recipientClientId,
  senderClientId,
  todoId,
  correlationId = v4(),
}: {
  recipientClientId: string;
  senderClientId: string;
  todoId: string;
  correlationId?: string;
}): ObjectDeleteTodoType => {
  const contentKey = TodoInternalKey.deleteTodoMEDS;
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

export const generateDeleteTodoAPPTMock = ({
  recipientClientId,
  senderClientId,
  todoId,
  correlationId = v4(),
}: {
  recipientClientId: string;
  senderClientId: string;
  todoId: string;
  correlationId?: string;
}): ObjectDeleteTodoType => {
  const contentKey = TodoInternalKey.deleteTodoAPPT;
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

export const generateDeleteTodoTODOMock = ({
  recipientClientId,
  senderClientId,
  todoId,
  correlationId = v4(),
}: {
  recipientClientId: string;
  senderClientId: string;
  todoId: string;
  correlationId?: string;
}): ObjectDeleteTodoType => {
  const contentKey = TodoInternalKey.deleteTodoTODO;
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
