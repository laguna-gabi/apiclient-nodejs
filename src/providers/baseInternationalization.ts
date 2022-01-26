import { Language } from '../';
import { Injectable, OnModuleInit } from '@nestjs/common';
import * as i18next from 'i18next';
import * as en from '../languages/en.json';
import * as es from '../languages/es.json';

@Injectable()
export class BaseInternationalization implements OnModuleInit {
  protected i18n = i18next as any; // typescript doesn't support the i18next library

  async onModuleInit() {
    await this.i18n.init({
      lng: Language.en,
      fallbackLng: Language.en,
      resources: { en, es },
      interpolation: { escapeValue: false },
    });
  }
}
