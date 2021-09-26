import * as config from 'config';
import { Member } from '../member';
import { User } from '../user';

export function log(text: string, className?: string) {
  const now = new Date();
  console.debug(
    `${now.toLocaleDateString()}, ${now.toLocaleTimeString()}   ${
      className ? `[${className}]` : ``
    } ${text}`,
  );
}

export function replaceConfigs(params: { content: string; member: Member; user: User }): string {
  const { content, member, user } = params;
  return content
    .replace('@member.honorific@', config.get(`contents.honorific.${member.honorific}`))
    .replace('@member.lastName@', capitalize(member.lastName))
    .replace('@user.firstName@', capitalize(user.firstName));
}

export function capitalize(content: string): string {
  return content[0].toUpperCase() + content.slice(1);
}
