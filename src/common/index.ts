import { registerEnumType } from '@nestjs/graphql';

export * from './errors';
export * from './events';
export * from './interfaces.dto';
export * from './customValidators';

export enum Language {
  en = 'en',
  es = 'es',
}
registerEnumType(Language, { name: 'Language' });
