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

export const generateCreateTodoMedsMock = ({
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
  const contentKey = TodoInternalKey.createTodoMeds;
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

export const generateCreateTodoAppointmentMock = ({
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
  const contentKey = TodoInternalKey.createTodoAppointment;
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

export const generateCreateTodoTodoMock = ({
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
  const contentKey = TodoInternalKey.createTodoTodo;
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
