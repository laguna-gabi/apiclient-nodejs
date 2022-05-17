import {
  BaseLogger,
  ChangeEventType,
  EntityName,
  GlobalEventType,
  IChangeEvent,
  QueueType,
} from '@argus/pandora';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Document, Schema, Types } from 'mongoose';
import { Audit } from '.';
import { getRequestClientId } from '../common';

/**************************************************************************************************
 ********************************** Audit Middlewares *********************************************
 *************************************************************************************************/

export function audit<TDocument extends Document>(schema: Schema<TDocument>) {
  // add `createdBy` and `updatedBy` fields to schema:
  schema.add(
    new Schema<Audit>({
      createdBy: { type: Schema.Types.ObjectId },
      updatedBy: { type: Schema.Types.ObjectId },
    }),
  );

  schema.pre('findOneAndUpdate', { document: false, query: true }, async function () {
    // get client id from local storage
    const clientId = getRequestClientId();

    const preUpdate = await this.model.findOne(this.getQuery());

    if (clientId) {
      // do not set the `createdBy` field if the record already exists
      if (!preUpdate) {
        this.set('createdBy', new Types.ObjectId(clientId));
      }

      // set `updatedBy` field
      this.set('updatedBy', new Types.ObjectId(clientId));
    }
  });

  schema.pre('findByIdAndUpdate', { document: false, query: true }, async function () {
    // get client id from local storage
    const clientId = getRequestClientId();

    const preUpdate = await this.model.findById(this.getQuery());

    if (clientId) {
      // do not set the `createdBy` field if the record already exists
      if (!preUpdate && clientId) {
        this.set('createdBy', new Types.ObjectId(clientId));
      }

      // set `updatedBy` field
      this.set('updatedBy', new Types.ObjectId(clientId));
    }
  });

  schema.pre('updateOne', { document: false, query: true }, async function () {
    // get client id from local storage
    const clientId = getRequestClientId();

    if (clientId) {
      // set `updatedBy` field
      this.set('updatedBy', new Types.ObjectId(clientId));
    }
  });

  schema.pre('save', async function () {
    // get client id from local storage
    const clientId = getRequestClientId();

    if (clientId) {
      // if `createdBy` already exists we should keep it..
      if (!(this as unknown as Audit)?.createdBy && clientId) {
        this.set('createdBy', new Types.ObjectId(clientId));
      }

      // set `updatedBy` field
      this.set('updatedBy', new Types.ObjectId(clientId));
    }
  });

  schema.pre('insertMany', async function (next, docs) {
    // get client id from local storage
    const clientId = getRequestClientId();

    if (clientId) {
      docs.map(async function (doc) {
        // set 'createdBy' and `updatedBy` fields
        doc.createdBy = new Types.ObjectId(clientId);
        doc.updatedBy = new Types.ObjectId(clientId);
      });

      next();
    }
  });

  schema.pre('updateMany', { document: false, query: true }, async function () {
    // get client id from local storage
    const clientId = getRequestClientId();

    const preUpdate = await this.model.find(this.getQuery());

    if (clientId) {
      // do not set the `createdBy` field if the records already exists
      if (!preUpdate) {
        this.set('createdBy', new Types.ObjectId(clientId));
      }

      // set `updatedBy` field
      this.set('updatedBy', new Types.ObjectId(clientId));
    }
  });

  return schema;
}

/**************************************************************************************************
 ********************************** Change Event Middlewares **************************************
 *************************************************************************************************/

export const ChangeEventFactoryProvider = (
  entity: EntityName,
  schema: Schema,
  memberIdKey: string,
) => {
  return (eventEmitter: EventEmitter2, loggerService: BaseLogger) => {
    schema.post(
      'save',
      buildCallbackFunction(
        memberIdKey,
        eventEmitter,
        loggerService,
        ChangeEventType.updated,
        entity,
        CallbackFnTypes.singleDoc,
      ),
    );

    // `remove` and `deleteOne` can be invoked from both model and document:
    schema.pre(
      ['remove', 'deleteOne'],
      { document: true, query: false },
      buildCallbackFunction(
        memberIdKey,
        eventEmitter,
        loggerService,
        ChangeEventType.deleted,
        entity,
        CallbackFnTypes.singleDoc,
      ),
    );

    schema.post(
      ['findOneAndUpdate', 'updateOne', 'update'],
      buildCallbackFunction(
        memberIdKey,
        eventEmitter,
        loggerService,
        ChangeEventType.updated,
        entity,
        CallbackFnTypes.querySingle,
      ),
    );

    schema.pre(
      ['findOneAndDelete', 'findOneAndRemove'],
      buildCallbackFunction(
        memberIdKey,
        eventEmitter,
        loggerService,
        ChangeEventType.deleted,
        entity,
        CallbackFnTypes.querySingle,
      ),
    );

    schema.pre(
      ['deleteMany'],
      buildCallbackFunction(
        memberIdKey,
        eventEmitter,
        loggerService,
        ChangeEventType.deleted,
        entity,
        CallbackFnTypes.queryMany,
      ),
    );

    schema.post(
      ['updateMany'],
      buildCallbackFunction(
        memberIdKey,
        eventEmitter,
        loggerService,
        ChangeEventType.updated,
        entity,
        CallbackFnTypes.queryMany,
      ),
    );

    // `remove` and `deleteOne` can be invoked from both model and document:
    schema.pre(
      ['remove', 'deleteOne'],
      { document: false, query: true },
      buildCallbackFunction(
        memberIdKey,
        eventEmitter,
        loggerService,
        ChangeEventType.deleted,
        entity,
        CallbackFnTypes.querySingleDelete,
      ),
    );

    return schema;
  };
};

/**************************************************************************************************
 ************************************** Service Functions *****************************************
 *************************************************************************************************/
enum CallbackFnTypes {
  queryMany = 'queryMany',
  querySingle = 'querySingle',
  querySingleDelete = 'querySingleDelete',
  singleDoc = 'singleDoc',
}

const buildCallbackFunction = (
  memberIdKey: string,
  eventEmitter: EventEmitter2,
  loggerService: BaseLogger,
  changeEventType: ChangeEventType,
  entity: EntityName,
  callbackFnTypes: CallbackFnTypes,
) => {
  switch (callbackFnTypes) {
    case CallbackFnTypes.queryMany:
      return async function () {
        const docs = await this.model.find(this.getQuery());

        // collect a set of unique member ids (avoid redundant dup emits)
        const memberIds = new Set<string>();
        docs.map((doc) => {
          memberIds.add(doc[memberIdKey].toString());
        });

        memberIds.forEach((memberId) => {
          emitChangeEvent(memberId, eventEmitter, loggerService, entity, changeEventType);
        });
      };
    case CallbackFnTypes.singleDoc: {
      return async function () {
        emitChangeEvent(
          this[memberIdKey].toString(),
          eventEmitter,
          loggerService,
          entity,
          changeEventType,
        );
      };
    }
    case CallbackFnTypes.querySingle: {
      return async function () {
        const doc = await this.model.findOne(this.getQuery());
        const memberId = doc[memberIdKey].toString();
        emitChangeEvent(memberId, eventEmitter, loggerService, entity, changeEventType);
      };
    }
    case CallbackFnTypes.querySingleDelete: {
      return async function () {
        const doc = await this.model.findOneWithDeleted(this.getQuery());
        const memberId = doc[memberIdKey];
        emitChangeEvent(memberId, eventEmitter, loggerService, entity, changeEventType);
      };
    }
  }
};

function emitChangeEvent(
  memberId: string,
  eventEmitter: EventEmitter2,
  loggerService: BaseLogger,
  entity: EntityName,
  action: ChangeEventType,
) {
  const changeEvent: IChangeEvent = {
    action,
    entity,
    memberId,
    correlationId: loggerService.getCorrelationId(),
  };

  eventEmitter.emit(GlobalEventType.notifyQueue, {
    type: QueueType.changeEvent,
    message: JSON.stringify(changeEvent),
  });
}
