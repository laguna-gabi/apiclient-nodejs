/* eslint-disable @typescript-eslint/no-unused-vars */
import { MemberRole, UserRole, isLagunaUser } from '@argus/hepiusClient';
import { EntityName, generateId, generateObjectId, mockProcessWarnings } from '@argus/pandora';
import { createMock } from '@golevelup/ts-jest';
import { ExecutionContext } from '@nestjs/common';
import { HttpArgumentsHost } from '@nestjs/common/interfaces';
import { Reflector } from '@nestjs/core';
import { AceGuard, EntityResolver } from '../../src/auth';
import { Types } from 'mongoose';
import { Member } from '../../src/member';
import { Journey } from '../../src/journey';
import { AceStrategy } from '../../src/common';

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

    it(`to allow access when ACE options indicate RBAC guard is sufficient`, async () => {
      spyOnMockReflectorGet
        .mockReturnValueOnce(false) // `isPublic`
        .mockReturnValueOnce({
          strategy: AceStrategy.rbac,
        }); // `aceOptions`

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
        org: generateObjectId(),
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
        org: new Types.ObjectId(orgId), // <- same orgId as the client provisioned org id
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
        org: new Types.ObjectId(orgId), // <- same orgId as the client provisioned org id
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
        org: generateObjectId(), // <- NOT the same orgId as the client provisioned org id
      });

      const guard = new AceGuard(mockReflector, mockEntityResolver);

      expect(await guard.canActivate(mockExecutionContext)).toBeFalsy();

      expect(spyOnMockEntityResolver).toHaveBeenNthCalledWith(1, Journey.name, entityId);
      expect(spyOnMockEntityResolver).toHaveBeenNthCalledWith(2, Member.name, memberId);
    });

    // eslint-disable-next-line max-len
    it(`to deny access for a non-Laguna coach user where affected member is not available`, async () => {
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

    // eslint-disable-next-line max-len
    test.each([AceStrategy.token, AceStrategy.rbac])(
      `to allow access for a non-Laguna coach user when strategy is set to %p (no ACE required)`,
      async (strategy) => {
        spyOnMockExecutionContextSwitchToHttp.mockReturnValueOnce(mockHttpArgumentsHost);
        spyOnMockHttpArgumentsHostGetRequest.mockReturnValueOnce({
          user: { roles: [UserRole.coach], orgs: [generateObjectId()] },
        });

        spyOnMockReflectorGet
          .mockReturnValueOnce(false) // `isPublic`
          .mockReturnValueOnce({
            strategy,
          }); // `aceOptions`

        const guard = new AceGuard(mockReflector, mockEntityResolver);

        expect(await guard.canActivate(mockExecutionContext)).toBeTruthy();
      },
    );

    // eslint-disable-next-line max-len
    it(`to allow access for a non-Laguna coach user based on org provisioning (by org id in args)`, async () => {
      const orgId1 = generateId();
      const orgId2 = generateId();

      spyOnMockExecutionContextSwitchToHttp.mockReturnValueOnce(mockHttpArgumentsHost);
      spyOnMockHttpArgumentsHostGetRequest.mockReturnValueOnce({
        user: {
          roles: [UserRole.coach],
          orgs: [new Types.ObjectId(orgId1), new Types.ObjectId(orgId2)],
        },
      });

      spyOnMockReflectorGet
        .mockReturnValueOnce(false) // `isPublic`
        .mockReturnValueOnce({
          strategy: AceStrategy.byOrg,
          idLocator: 'orgIds',
        }); // `aceOptions`

      // we have an entity id ('id') in args (not a member)
      spyOnMockExecutionContextGetArgByIndex.mockReturnValue({
        params: { myInputParams: { orgIds: [orgId1] } },
      });

      const guard = new AceGuard(mockReflector, mockEntityResolver);

      expect(await guard.canActivate(mockExecutionContext)).toBeTruthy();
    });

    // eslint-disable-next-line max-len
    it(`to deny access for a non-Laguna coach user based on org provisioning (by org id in args) - inconsistent org ids in request`, async () => {
      const orgId1 = generateId();
      const orgId2 = generateId();

      spyOnMockExecutionContextSwitchToHttp.mockReturnValueOnce(mockHttpArgumentsHost);
      spyOnMockHttpArgumentsHostGetRequest.mockReturnValueOnce({
        user: {
          roles: [UserRole.coach],
          orgs: [new Types.ObjectId(orgId1)],
        },
      });

      spyOnMockReflectorGet
        .mockReturnValueOnce(false) // `isPublic`
        .mockReturnValueOnce({
          strategy: AceStrategy.byOrg,
          idLocator: 'orgIds',
        }); // `aceOptions`

      // we have an entity id ('id') in args (not a member)
      spyOnMockExecutionContextGetArgByIndex.mockReturnValue({
        myInputParams: { orgIds: [orgId2] },
      });

      const guard = new AceGuard(mockReflector, mockEntityResolver);

      expect(await guard.canActivate(mockExecutionContext)).toBeFalsy();
    });

    // eslint-disable-next-line max-len
    it(`to allow access for a non-Laguna coach user based on org provisioning (by org id in args) - when no org ids in request`, async () => {
      const orgId1 = generateId();
      const orgId2 = generateId();
      const aceOptions = {
        strategy: AceStrategy.byOrg,
        idLocator: 'orgIds',
      };
      const provisionedOrgIds = [orgId1, orgId2];

      spyOnMockExecutionContextSwitchToHttp.mockReturnValueOnce(mockHttpArgumentsHost);
      spyOnMockHttpArgumentsHostGetRequest.mockReturnValueOnce({
        user: {
          roles: [UserRole.coach],
          orgs: provisionedOrgIds,
        },
      });

      spyOnMockReflectorGet
        .mockReturnValueOnce(false) // `isPublic`
        .mockReturnValueOnce(aceOptions); // `aceOptions`

      spyOnMockExecutionContextGetArgByIndex.mockReturnValue({});

      const guard = new AceGuard(mockReflector, mockEntityResolver);

      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      const mockGuardSetRequestOrgIds = jest.spyOn(guard, 'setRequestOrgIds');

      expect(await guard.canActivate(mockExecutionContext)).toBeTruthy();
      expect(mockGuardSetRequestOrgIds).toHaveBeenCalledWith(
        expect.anything(),
        aceOptions,
        provisionedOrgIds,
      );
    });

    it(`to allow access for a member based on org provisioning (by org id in args)`, async () => {
      const orgId1 = generateId();
      const aceOptions = {
        strategy: AceStrategy.byOrg,
        idLocator: 'orgIds',
      };

      spyOnMockExecutionContextSwitchToHttp.mockReturnValueOnce(mockHttpArgumentsHost);
      spyOnMockHttpArgumentsHostGetRequest.mockReturnValueOnce({
        user: {
          roles: [MemberRole.member],
          org: orgId1, // <- member has a single provisioned org
        },
      });

      spyOnMockReflectorGet
        .mockReturnValueOnce(false) // `isPublic`
        .mockReturnValueOnce(aceOptions); // `aceOptions`

      spyOnMockExecutionContextGetArgByIndex.mockReturnValue({ orgIds: [orgId1] });

      const guard = new AceGuard(mockReflector, mockEntityResolver);

      expect(await guard.canActivate(mockExecutionContext)).toBeTruthy();
    });

    it(`to deny access for a member based on org provisioning (by org id in args)`, async () => {
      const orgId1 = generateId();
      const orgId2 = generateId();
      const aceOptions = {
        strategy: AceStrategy.byOrg,
        idLocator: 'orgIds',
      };

      spyOnMockExecutionContextSwitchToHttp.mockReturnValueOnce(mockHttpArgumentsHost);
      spyOnMockHttpArgumentsHostGetRequest.mockReturnValueOnce({
        user: {
          roles: [MemberRole.member],
          org: orgId1, // <- member has a single provisioned org
        },
      });

      spyOnMockReflectorGet
        .mockReturnValueOnce(false) // `isPublic`
        .mockReturnValueOnce(aceOptions); // `aceOptions`

      spyOnMockExecutionContextGetArgByIndex.mockReturnValue({ orgIds: [orgId2] });

      const guard = new AceGuard(mockReflector, mockEntityResolver);

      expect(await guard.canActivate(mockExecutionContext)).toBeFalsy();
    });

    // eslint-disable-next-line max-len
    it(`to deny access for a non-Laguna coach user where affected member is not available`, async () => {
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

    // eslint-disable-next-line max-len
    test.each([AceStrategy.token, AceStrategy.rbac])(
      `to allow access for a non-Laguna coach user when strategy is set to %p (no ACE required)`,
      async (strategy) => {
        spyOnMockExecutionContextSwitchToHttp.mockReturnValueOnce(mockHttpArgumentsHost);
        spyOnMockHttpArgumentsHostGetRequest.mockReturnValueOnce({
          user: { roles: [UserRole.coach], orgs: [generateObjectId()] },
        });

        spyOnMockReflectorGet
          .mockReturnValueOnce(false) // `isPublic`
          .mockReturnValueOnce({
            strategy,
          }); // `aceOptions`

        const guard = new AceGuard(mockReflector, mockEntityResolver);

        expect(await guard.canActivate(mockExecutionContext)).toBeTruthy();
      },
    );
  });

  test.each`
    roles                                           | isLagunaUser
    ${[UserRole.coach]}                             | ${false}
    ${[MemberRole.member]}                          | ${false}
    ${[UserRole.lagunaCoach]}                       | ${true}
    ${[UserRole.lagunaCoach, UserRole.lagunaAdmin]} | ${true}
    ${[]}                                           | ${false}
    ${undefined}                                    | ${false}
    ${['lagunaCoach', 'lagunaAdmin']}               | ${true}
  `('isLagunaUser === $isLagunaUser when user has roles: $roles', (params) => {
    expect(isLagunaUser(params.roles)).toBe(params.isLagunaUser);
  });
});
