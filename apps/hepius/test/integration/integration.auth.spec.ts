import { Handler } from '../aux';
import { generateRequestHeaders } from '../index';

describe('Integration tests : RBAC', () => {
  const handler: Handler = new Handler();
  let requestHeaders;

  beforeAll(async () => {
    await handler.beforeAll();
    requestHeaders = generateRequestHeaders(handler.patientZero.authId);
  }, 10000);

  afterAll(async () => {
    await handler.afterAll();
  });

  it('expecting `member` to be denied access to a secure (`coach` only) endpoint', async () => {
    const { errors } = await handler.queries.getMembers({
      orgId: handler.lagunaOrg.id,
      requestHeaders,
    });

    expect(errors?.[0]?.message).toBe('Forbidden resource');
  });

  it('expecting `member` to be granted access to an endpoint', async () => {
    const { errors } = await handler.queries.getMember({
      id: handler.patientZero.id.toString(),
      requestHeaders,
    });

    expect(errors?.[0]?.message).toBeUndefined();
  });
});
