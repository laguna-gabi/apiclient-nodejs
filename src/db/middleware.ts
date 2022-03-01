import { Document, Schema, Types } from 'mongoose';
import { Audit } from '.';
import { getRequestClientId } from '../common';

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

  return schema;
}
