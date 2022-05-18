import {
  AlertInternalKey,
  AppointmentInternalKey,
  ChatInternalKey,
  ContentCategories,
  ExternalKey,
  JournalCustomKey,
  LogInternalKey,
  NotifyCustomKey,
  RegisterInternalKey,
  TodoInternalKey,
} from '../src';

test.each([
  RegisterInternalKey,
  AppointmentInternalKey,
  TodoInternalKey,
  AlertInternalKey,
  LogInternalKey,
  ChatInternalKey,
  NotifyCustomKey,
  JournalCustomKey,
  ExternalKey,
])('contentKeys must have category', async (contentKey) => {
  Object.values(contentKey).forEach((contentKeyValue) => {
    expect(ContentCategories.get(contentKeyValue)).not.toBeUndefined();
  });
});
