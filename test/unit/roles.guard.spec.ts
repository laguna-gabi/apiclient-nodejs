import { createMock } from '@golevelup/ts-jest';
import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthService, RolesGuard } from '../../src/auth';

describe('RolesGuard', () => {
  const mockReflector = createMock<Reflector>();
  const mockAuthService = createMock<AuthService>();
  const mockExecutionContext = createMock<ExecutionContext>();

  const spyOnMockReflector = jest.spyOn(mockReflector, 'get');
  const spyOnMockAuthService = jest.spyOn(mockAuthService, 'isAllowed');
  const spyOnMockExecutionContext = jest.spyOn(mockExecutionContext, 'getType');

  afterEach(() => {
    spyOnMockReflector.mockReset();
    spyOnMockAuthService.mockReset();
    spyOnMockExecutionContext.mockReset();
  });

  describe('validateUser', () => {
    // eslint-disable-next-line max-len
    it(`to allow access for empty role list in guard annotation when endpoint is public`, async () => {
      spyOnMockReflector.mockReturnValueOnce([]).mockReturnValueOnce(true);

      const guard = new RolesGuard(mockReflector, mockAuthService);

      expect(guard.canActivate(mockExecutionContext)).toBeTruthy();
    });

    // eslint-disable-next-line max-len
    it('to deny access for empty role list in guard annotation when endpoint is NOT public', async () => {
      spyOnMockReflector.mockReturnValueOnce([]).mockReturnValueOnce(false);

      const guard = new RolesGuard(mockReflector, mockAuthService);

      expect(guard.canActivate(mockExecutionContext)).toBeFalsy();
    });

    // eslint-disable-next-line max-len
    it('to deny access for a non-empty role list in guard annotation when service says Not Allowed', async () => {
      spyOnMockReflector.mockReturnValueOnce(['User']);
      spyOnMockAuthService.mockReturnValue(false);

      const guard = new RolesGuard(mockReflector, mockAuthService);

      expect(guard.canActivate(mockExecutionContext)).toBeFalsy();
    });

    // eslint-disable-next-line max-len
    it('to allow access for a non-empty role list in guard annotation when service says Allowed', async () => {
      spyOnMockReflector.mockReturnValueOnce(['User']);
      spyOnMockAuthService.mockReturnValue(true);

      const guard = new RolesGuard(mockReflector, mockAuthService);

      expect(guard.canActivate(mockExecutionContext)).toBeTruthy();
    });
  });
});
