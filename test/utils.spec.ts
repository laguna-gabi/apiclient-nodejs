import { ContentKey, generateDispatchId, generateOrgNamePrefix } from '../src';
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
      expect(generateDispatchId(ContentKey.newMember)).toEqual(ContentKey.newMember);
    });

    it('should return contentKey and array with 1 item as inputs', () => {
      const item = lorem.word();
      expect(generateDispatchId(ContentKey.newMember, item)).toEqual(
        `${ContentKey.newMember}_${item}`,
      );
    });

    it('should return contentKey and sorted array with multiple items as inputs', () => {
      const items = ['b', 'a'];
      expect(generateDispatchId(ContentKey.newMember, ...items)).toEqual(
        `${ContentKey.newMember}_${items[1]}_${items[0]}`,
      );
    });
  });
});
