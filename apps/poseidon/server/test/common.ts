import { ServiceName } from '@argus/pandora';
import { db } from 'config';
import { connect, disconnect } from 'mongoose';

export const dbConnect = async () => {
  await connect(`${db.connection}/${ServiceName.poseidon}`);
};

export const dbDisconnect = async () => {
  await disconnect();
};
