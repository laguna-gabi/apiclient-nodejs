import * as config from 'config';
import { utcToZonedTime } from 'date-fns-tz';
import { format } from 'date-fns';
import { lookup } from 'zipcode-to-timezone';
import { Member } from '../member';
import { User } from '../user';

export function replaceConfigs(params: { content: string; member: Member; user: User }): string {
  const { content, member, user } = params;
  return content
    .replace('@member.honorific@', config.get(`contents.honorific.${member.honorific}`))
    .replace('@member.lastName@', capitalize(member.lastName))
    .replace('@user.firstName@', capitalize(user.firstName))
    .replace('@appointment.time@', formatDate(zipcodeToTimeZone(new Date(), member.zipCode)));
}

export function capitalize(content: string): string {
  return content[0].toUpperCase() + content.slice(1);
}

function zipcodeToTimeZone(date: Date, zipcode: string): Date {
  return utcToZonedTime(date, lookup(zipcode));
}

function formatDate(date: Date): string {
  return format(date, "EEEE LLLL do 'at' p");
}
