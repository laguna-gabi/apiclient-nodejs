export const apiPrefix = 'api';
export const webhooks = 'webhooks';
export const bearerToken = 'Bearer ';
export const onlyDateRegex = /^\d{4}(\/)(((0)[0-9])|((1)[0-2]))(\/)([0-2][0-9]|(3)[0-1])$/i;
export const momentFormats = {
  date: 'yyyy/MM/dd',
  mysqlDate: 'yyyy-MM-dd',
  time: 'HH:mm:ss',
  dateTime: `yyyy/MM/dd HH:mm`,
  mysqlDateTime: `yyyy-MM-dd HH:mm`,
  dayOfWeek: 'EEEE',
  hour: 'H',
};

export const queryDaysLimit = {
  getMembersAppointments: 14,
  getAvailabilities: 30,
};
