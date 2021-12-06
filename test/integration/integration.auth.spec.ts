import { Handler } from '../aux';

describe('Integration tests : RBAC', () => {
  const handler: Handler = new Handler();

  beforeAll(async () => {
    await handler.beforeAll(true);
    handler.mockCommunication();
  });

  afterAll(async () => {
    await handler.afterAll();
  });

  it('expecting `member` to be denied access to a secure (`coach` only) endpoint', async () => {
    const { errors } = await handler
      .setContextUser(undefined, handler.patientZero.authId)
      .queries.getMembers(handler.lagunaOrg.id);

    expect(errors?.[0]?.message).toBe('Forbidden resource');
  });

  it('expecting `member` to be granted access to an endpoint', async () => {
    const { errors } = await handler
      .setContextUser(undefined, handler.patientZero.authId)
      .queries.getMember({ id: handler.patientZero.id.toString() });

    expect(errors?.[0]?.message).toBeUndefined();
  });
});
