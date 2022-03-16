import { v4 } from 'uuid';
import {
  ICreateDispatch,
  InnerQueueTypes,
  NotificationType,
  ObjectBaseType,
  ServiceName,
  TodoInternalKey,
  generateDispatchId,
} from '../index';

export type ObjectCreateTodoType = ObjectBaseType & Pick<ICreateDispatch, 'path'>;

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
  const contentKey = TodoInternalKey.createTodoMEDS;
  return {
    type: InnerQueueTypes.createDispatch,
    dispatchId: generateDispatchId(contentKey, recipientClientId, todoId),
    correlationId,
    serviceName: ServiceName.hepius,
    notificationType: NotificationType.text,
    recipientClientId,
    senderClientId,
    contentKey,
    path: 'todo',
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
  const contentKey = TodoInternalKey.createTodoAPPT;
  return {
    type: InnerQueueTypes.createDispatch,
    dispatchId: generateDispatchId(contentKey, recipientClientId, todoId),
    correlationId,
    serviceName: ServiceName.hepius,
    notificationType: NotificationType.text,
    recipientClientId,
    senderClientId,
    contentKey,
    path: 'todo',
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
  const contentKey = TodoInternalKey.createTodoTODO;
  return {
    type: InnerQueueTypes.createDispatch,
    dispatchId: generateDispatchId(contentKey, recipientClientId, todoId),
    correlationId,
    serviceName: ServiceName.hepius,
    notificationType: NotificationType.text,
    recipientClientId,
    senderClientId,
    contentKey,
    path: 'todo',
  };
};
