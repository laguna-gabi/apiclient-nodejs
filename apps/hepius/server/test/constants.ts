import { apiPrefix } from '../src/common';
import { webhooks } from '@argus/pandora';

export const BEFORE_ALL_TIMEOUT = 15000;

export const stringError = `String cannot represent a non string value`;
export const booleanError = `Boolean cannot represent a non boolean value`;
export const floatError = `Float cannot represent non numeric value`;
export const intError = `Int cannot represent non-integer value`;

export const urls = {
  scheduleAppointments: `/${apiPrefix}/appointments/schedule`,
  slots: `/${apiPrefix}/users/slots`,
  members: `/${apiPrefix}/members/create`,
  orgs: `/${apiPrefix}/orgs/details`,
  webhooks: `/${apiPrefix}/${webhooks}`,
};
