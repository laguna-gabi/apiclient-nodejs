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

export type ObjectUpdateTodoType = ObjectBaseType & Pick<ICreateDispatch, 'path'>;

export class ObjectUpdateTodoClass {
  constructor(readonly objectUpdateTodoMock: ObjectUpdateTodoType) {}
}

export const generateUpdateTodoMEDSMock = ({
  recipientClientId,
  senderClientId,
  todoId,
  correlationId = v4(),
}: {
  recipientClientId: string;
  senderClientId: string;
  todoId: string;
  correlationId?: string;
}): ObjectUpdateTodoType => {
  const contentKey = TodoInternalKey.updateTodoMEDS;
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
export const generateUpdateTodoAPPTMock = ({
  recipientClientId,
  senderClientId,
  todoId,
  correlationId = v4(),
}: {
  recipientClientId: string;
  senderClientId: string;
  todoId: string;
  correlationId?: string;
}): ObjectUpdateTodoType => {
  const contentKey = TodoInternalKey.updateTodoAPPT;
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
export const generateUpdateTodoTODOMock = ({
  recipientClientId,
  senderClientId,
  todoId,
  correlationId = v4(),
}: {
  recipientClientId: string;
  senderClientId: string;
  todoId: string;
  correlationId?: string;
}): ObjectUpdateTodoType => {
  const contentKey = TodoInternalKey.updateTodoTODO;
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
