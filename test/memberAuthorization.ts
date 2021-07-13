import * as jwt from 'jsonwebtoken';
import { datatype } from 'faker';

export const authorizedDeviceId = jwt.sign(
  { username: datatype.uuid() },
  'abc',
);

export const context = {
  req: { headers: { authorization: `Bearer ${authorizedDeviceId}` } },
};
