import { InternalKey, generateDispatchId, generateOrgNamePrefix } from '../src';
import { lorem } from 'faker';

describe('Utils', () => {
  describe('generateOrgNamePrefix', () => {
    it('should return empty string generateOrgNamePrefix on no orgName', () => {
      expect(generateOrgNamePrefix()).toEqual('');
    });

    it('should return org string generateOrgNamePrefix when orgName provided', () => {
      const orgName = lorem.word();
      expect(generateOrgNamePrefix(orgName)).toEqual(` [${orgName}] `);
    });
  });

  describe('generateDispatchId', () => {
    it('should return just contentKey on no options', () => {
      expect(generateDispatchId(InternalKey.newMember)).toEqual(InternalKey.newMember);
    });

    it('should return contentKey and array with 1 item as inputs', () => {
      const item = lorem.word();
      expect(generateDispatchId(InternalKey.newMember, item)).toEqual(
        `${InternalKey.newMember}_${item}`,
      );
    });

    it('should return contentKey and sorted array with multiple items as inputs', () => {
      const items = ['b', 'a'];
      expect(generateDispatchId(InternalKey.newMember, ...items)).toEqual(
        `${InternalKey.newMember}_${items[1]}_${items[0]}`,
      );
    });
  });
});
