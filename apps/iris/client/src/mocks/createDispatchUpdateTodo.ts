import { NotificationType, ServiceName } from '@argus/pandora';
import { v4 } from 'uuid';
import { ObjectBaseType } from '.';
import { ICreateDispatch, InnerQueueTypes, TodoInternalKey, generateDispatchId } from '..';

export type ObjectUpdateTodoType = ObjectBaseType & Pick<ICreateDispatch, 'path'>;

export class ObjectUpdateTodoClass {
  constructor(readonly objectUpdateTodoMock: ObjectUpdateTodoType) {}
}

export const generateUpdateTodoMedsMock = ({
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
  const contentKey = TodoInternalKey.updateTodoMeds;
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
export const generateUpdateTodoAppointmentMock = ({
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
  const contentKey = TodoInternalKey.updateTodoAppointment;
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
export const generateUpdateTodoTodoMock = ({
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
  const contentKey = TodoInternalKey.updateTodoTodo;
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
