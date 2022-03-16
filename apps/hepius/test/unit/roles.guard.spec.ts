import { createMock } from '@golevelup/ts-jest';
import { ExecutionContext } from '@nestjs/common';
import { HttpArgumentsHost } from '@nestjs/common/interfaces';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from '../../src/auth';

describe('RolesGuard', () => {
  const mockReflector = createMock<Reflector>();
  const mockExecutionContext = createMock<ExecutionContext>();
  const mockHttpArgumentsHost = createMock<HttpArgumentsHost>();

  const spyOnMockReflectorGet = jest.spyOn(mockReflector, 'get');
  const spyOnMockExecutionContextSwitchToHttp = jest.spyOn(mockExecutionContext, 'switchToHttp');
  const spyOnMockHttpArgumentsHostGetRequest = jest.spyOn(mockHttpArgumentsHost, 'getRequest');

  describe('validateUser', () => {
    /* eslint-disable-next-line max-len */
    it(`to allow access for empty role list in guard annotation when endpoint is public`, async () => {
      spyOnMockReflectorGet.mockReturnValueOnce([]).mockReturnValueOnce(true);

      const guard = new RolesGuard(mockReflector);

      expect(guard.canActivate(mockExecutionContext)).toBeTruthy();
    });

    /* eslint-disable-next-line max-len */
    it('to deny access for empty role list in guard annotation when endpoint is NOT public', async () => {
      spyOnMockReflectorGet.mockReturnValueOnce([]).mockReturnValueOnce(false);

      const guard = new RolesGuard(mockReflector);

      expect(guard.canActivate(mockExecutionContext)).toBeFalsy();
    });

    /* eslint-disable-next-line max-len */
    it('to deny access for a non-empty role list in guard annotation when service says Not Allowed', async () => {
      spyOnMockReflectorGet.mockReturnValueOnce(['coach']);
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      spyOnMockHttpArgumentsHostGetRequest.mockReturnValueOnce({ user: { roles: ['member'] } });
      spyOnMockExecutionContextSwitchToHttp.mockReturnValueOnce(mockHttpArgumentsHost);
      const guard = new RolesGuard(mockReflector);

      expect(guard.canActivate(mockExecutionContext)).toBeFalsy();
    });

    /* eslint-disable-next-line max-len */
    it('to allow access for a non-empty role list in guard annotation when service says Allowed', async () => {
      spyOnMockReflectorGet.mockReturnValueOnce(['coach', 'member']);
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      spyOnMockHttpArgumentsHostGetRequest.mockReturnValueOnce({
        user: { roles: ['coach', 'nurse'] },
      });
      spyOnMockExecutionContextSwitchToHttp.mockReturnValueOnce(mockHttpArgumentsHost);
      const guard = new RolesGuard(mockReflector);

      expect(guard.canActivate(mockExecutionContext)).toBeTruthy();
    });
  });
});
