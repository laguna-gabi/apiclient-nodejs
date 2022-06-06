/* eslint-disable @typescript-eslint/no-unused-vars */
import { UserRole } from '@argus/hepiusClient';
import { EntityName, generateId, generateObjectId, mockProcessWarnings } from '@argus/pandora';
import { createMock } from '@golevelup/ts-jest';
import { ExecutionContext } from '@nestjs/common';
import { HttpArgumentsHost } from '@nestjs/common/interfaces';
import { Reflector } from '@nestjs/core';
import { AceGuard, EntityResolver } from '../../src/auth';
import { Types } from 'mongoose';
import { Member } from '../../src/member';
import { Journey } from '../../src/journey';

describe(AceGuard.name, () => {
  const mockReflector = createMock<Reflector>();
  const mockExecutionContext = createMock<ExecutionContext>();
  const mockHttpArgumentsHost = createMock<HttpArgumentsHost>();
  const mockEntityResolver = createMock<EntityResolver>();

  const spyOnMockReflectorGet = jest.spyOn(mockReflector, 'get');
  const spyOnMockExecutionContextSwitchToHttp = jest.spyOn(mockExecutionContext, 'switchToHttp');
  const spyOnMockExecutionContextGetArgByIndex = jest.spyOn(mockExecutionContext, 'getArgByIndex');
  const spyOnMockHttpArgumentsHostGetRequest = jest.spyOn(mockHttpArgumentsHost, 'getRequest');
  const spyOnMockEntityResolver = jest.spyOn(mockEntityResolver, 'getEntityById');

  describe(`canActivate`, () => {
    beforeEach(() => {
      spyOnMockReflectorGet.mockReset();
      spyOnMockExecutionContextSwitchToHttp.mockReset();
      spyOnMockExecutionContextGetArgByIndex.mockReset();
      spyOnMockHttpArgumentsHostGetRequest.mockReset();
      spyOnMockEntityResolver.mockReset();
    });

    test.each([
      { roles: [UserRole.lagunaCoach] },
      { roles: [UserRole.lagunaAdmin] },
      { roles: [UserRole.lagunaNurse] },
      { roles: [UserRole.lagunaAdmin, UserRole.coach] },
    ])(`to allow access for a Laguna user %p`, async (client) => {
      spyOnMockExecutionContextSwitchToHttp.mockReturnValueOnce(mockHttpArgumentsHost);
      spyOnMockHttpArgumentsHostGetRequest.mockReturnValueOnce({ user: { roles: client.roles } });
      const guard = new AceGuard(mockReflector, mockEntityResolver);

      expect(await guard.canActivate(mockExecutionContext)).toBeTruthy();
    });

    it(`to allow access when handler is marked as public`, async () => {
      spyOnMockReflectorGet.mockReturnValueOnce(true); // `isPublic`

      const guard = new AceGuard(mockReflector, null);

      expect(await guard.canActivate(mockExecutionContext)).toBeTruthy();
    });

    // eslint-disable-next-line max-len
    it(`to deny access for a non-Laguna coach user when ACE options are not annotated`, async () => {
      spyOnMockExecutionContextSwitchToHttp.mockReturnValueOnce(mockHttpArgumentsHost);
      spyOnMockHttpArgumentsHostGetRequest.mockReturnValueOnce({
        user: { roles: [UserRole.coach] },
      });

      const guard = new AceGuard(mockReflector, mockEntityResolver);

      expect(await guard.canActivate(mockExecutionContext)).toBeFalsy();
    });

    // eslint-disable-next-line max-len
    it(`to deny access for a non-Laguna coach user due to missing org provisioning (memberId in args)`, async () => {
      const memberId = generateId();

      spyOnMockExecutionContextSwitchToHttp.mockReturnValueOnce(mockHttpArgumentsHost);
      spyOnMockHttpArgumentsHostGetRequest.mockReturnValueOnce({
        user: { roles: [UserRole.coach], orgs: [generateObjectId()] },
      });

      spyOnMockReflectorGet
        .mockReturnValueOnce(false) // `isPublic`
        .mockReturnValueOnce({
          entityName: Member.name,
          idLocator: 'memberId',
        }); // `aceOptions`

      spyOnMockExecutionContextGetArgByIndex.mockReturnValueOnce({
        params: { memberId },
      });

      spyOnMockEntityResolver.mockResolvedValue({
        _id: generateObjectId(),
        org: { id: generateId() },
      });

      const guard = new AceGuard(mockReflector, mockEntityResolver);

      expect(await guard.canActivate(mockExecutionContext)).toBeFalsy();

      expect(spyOnMockEntityResolver).toHaveBeenNthCalledWith(1, Member.name, memberId);
    });

    // eslint-disable-next-line max-len
    it(`to allow access for a non-Laguna coach user based on org provisioning (memberId in args)`, async () => {
      const orgId = generateId();
      const memberId = generateId();

      spyOnMockExecutionContextSwitchToHttp.mockReturnValueOnce(mockHttpArgumentsHost);
      spyOnMockHttpArgumentsHostGetRequest.mockReturnValueOnce({
        user: { roles: [UserRole.coach], orgs: [new Types.ObjectId(orgId)] },
      });

      spyOnMockReflectorGet
        .mockReturnValueOnce(false) // `isPublic`
        .mockReturnValueOnce({
          entityName: EntityName.member,
          idLocator: 'memberId',
        }); // `aceOptions`

      spyOnMockExecutionContextGetArgByIndex.mockReturnValue({
        params: { memberId },
      });

      spyOnMockEntityResolver.mockResolvedValue({
        _id: generateObjectId(),
        org: { id: orgId }, // <- same orgId as the client provisioned org id
      });
      const guard = new AceGuard(mockReflector, mockEntityResolver);

      expect(await guard.canActivate(mockExecutionContext)).toBeTruthy();

      expect(spyOnMockEntityResolver).toHaveBeenNthCalledWith(1, Member.name, memberId);
    });

    // eslint-disable-next-line max-len
    it(`to allow access for a non-Laguna coach user based on org provisioning (by entity id in args)`, async () => {
      const orgId = generateId();
      spyOnMockExecutionContextSwitchToHttp.mockReturnValueOnce(mockHttpArgumentsHost);
      spyOnMockHttpArgumentsHostGetRequest.mockReturnValueOnce({
        user: { roles: [UserRole.coach], orgs: [new Types.ObjectId(orgId)] },
      });

      spyOnMockReflectorGet
        .mockReturnValueOnce(false) // `isPublic`
        .mockReturnValueOnce({
          entityName: Journey.name,
          idLocator: 'id',
          entityMemberIdLocator: `customMemberId`,
        }); // `aceOptions`

      // we have an entity id ('id') in args (not a member)
      const entityId = generateId();
      spyOnMockExecutionContextGetArgByIndex.mockReturnValue({
        params: { id: entityId },
      });

      // the first call to the entity resolver will get us an entity with a member id
      // (`customMemberId` is the member id field)
      const memberId = generateId();
      spyOnMockEntityResolver.mockResolvedValueOnce({
        _id: generateObjectId(),
        customMemberId: memberId,
      });

      // the second call to the entity resolver will get us the member with the org association (`orgId`)
      spyOnMockEntityResolver.mockResolvedValueOnce({
        _id: generateObjectId(),
        org: { id: orgId }, // <- same orgId as the client provisioned org id
      });

      const guard = new AceGuard(mockReflector, mockEntityResolver);

      expect(await guard.canActivate(mockExecutionContext)).toBeTruthy();

      expect(spyOnMockEntityResolver).toHaveBeenNthCalledWith(1, Journey.name, entityId);
      expect(spyOnMockEntityResolver).toHaveBeenNthCalledWith(2, Member.name, memberId);
    });

    // eslint-disable-next-line max-len
    it(`to deny access for a non-Laguna coach user based on org provisioning (by entity id in args)`, async () => {
      const orgId = generateId();
      const entityId = generateId();
      const memberId = generateId();

      spyOnMockExecutionContextSwitchToHttp.mockReturnValueOnce(mockHttpArgumentsHost);
      spyOnMockHttpArgumentsHostGetRequest.mockReturnValueOnce({
        user: { roles: [UserRole.coach], orgs: [new Types.ObjectId(orgId)] },
      });

      spyOnMockReflectorGet
        .mockReturnValueOnce(false) // `isPublic`
        .mockReturnValueOnce({
          entityName: Journey.name,
          idLocator: 'id',
          entityMemberIdLocator: `customMemberId`,
        }); // `aceOptions`

      // we have an entity id ('id') in args (not a member)
      spyOnMockExecutionContextGetArgByIndex.mockReturnValue({
        params: { id: entityId },
      });

      // the first call to the entity resolver will get us an entity with a member id
      // (`customMemberId` is the member id field)
      spyOnMockEntityResolver.mockResolvedValueOnce({
        _id: generateObjectId(),
        customMemberId: memberId,
      });

      // the second call to the entity resolver will get us the member with the org association (`orgId`)
      spyOnMockEntityResolver.mockResolvedValueOnce({
        _id: generateObjectId(),
        org: { id: generateId() }, // <- NOT the same orgId as the client provisioned org id
      });

      const guard = new AceGuard(mockReflector, mockEntityResolver);

      expect(await guard.canActivate(mockExecutionContext)).toBeFalsy();

      expect(spyOnMockEntityResolver).toHaveBeenNthCalledWith(1, Journey.name, entityId);
      expect(spyOnMockEntityResolver).toHaveBeenNthCalledWith(2, Member.name, memberId);
    });

    // eslint-disable-next-line max-len
    it(`to deny access for a non-Laguna coach user where affected member is not available and handler is not marked as custom ACE`, async () => {
      spyOnMockExecutionContextSwitchToHttp.mockReturnValueOnce(mockHttpArgumentsHost);
      spyOnMockHttpArgumentsHostGetRequest.mockReturnValueOnce({
        user: { roles: [UserRole.coach], orgs: [generateObjectId()] },
      });

      spyOnMockReflectorGet
        .mockReturnValueOnce(false) // `isPublic`
        .mockReturnValueOnce(false); // `aceOptions`

      const guard = new AceGuard(mockReflector, mockEntityResolver);

      expect(await guard.canActivate(mockExecutionContext)).toBeFalsy();
    });
  });
});
