import { Injectable, OnModuleInit } from '@nestjs/common';
import * as i18next from 'i18next';
import { cloneDeep } from 'lodash';
import * as en from '../../languages/en.json';
import * as es from '../../languages/es.json';
import { Member } from '../member';
import { User } from '../user';
import { ContentKey, ExtraData, Language } from '@lagunahealth/pandora';

export class GetContentsParams {
  contentType: ContentKey;
  member?: Member;
  user?: User;
  extraData?: ExtraData;
  language?: Language;
}

@Injectable()
export class InternationalizationService implements OnModuleInit {
  i18n = i18next as any; // typescript doesn't support the i18next library

  async onModuleInit() {
    await this.i18n.init({
      lng: Language.en,
      fallbackLng: Language.en,
      resources: { en, es },
      interpolation: { escapeValue: false },
    });
  }

  getContents(params: GetContentsParams) {
    const { contentType, user, extraData, language } = params;
    const member = cloneDeep(params.member);
    if (member) {
      member.honorific = this.i18n.t(`honorific.${member.honorific}`, { member, lng: language });
    }
    return this.i18n.t(`contents.${contentType}`, { member, user, ...extraData, lng: language });
  }
}
