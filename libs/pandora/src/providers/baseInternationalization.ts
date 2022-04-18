import { Injectable, OnModuleInit } from '@nestjs/common';
import * as i18next from 'i18next';
import { Language } from '..';
import * as en from '../languages/en.json';
import * as es from '../languages/es.json';
import * as NorthshoreBeta from '../languages/NorthshoreBeta.json';

@Injectable()
export class BaseInternationalization implements OnModuleInit {
  protected i18n = i18next;
  protected supportedOrgNameLanguages = ['NorthshoreBeta'];

  async onModuleInit() {
    await this.i18n.init({
      lng: Language.en,
      fallbackLng: Language.en,
      resources: { en, es, NorthshoreBeta },
      interpolation: { escapeValue: false },
      returnEmptyString: false,
    });
  }
}
