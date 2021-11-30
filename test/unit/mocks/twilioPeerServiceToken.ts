export const twilioPeerServiceToken = {
  accountSid: 'ACCOUNT-SID',
  dateCreated: new Date(),
  dateUpdated: new Date(),
  iceServers: [
    {
      url: 'stun:global.stun.twilio.com:3478?transport=udp',
      urls: 'stun:global.stun.twilio.com:3478?transport=udp',
    },
    {
      url: 'turn:global.turn.twilio.com:3478?transport=udp',
      username: '63d97d6ac1466c88184ee201e3610fe2a8cda5ec9e70a9fa30f8c427ab84cf6e',
      urls: 'turn:global.turn.twilio.com:3478?transport=udp',
      credential: 'Bl5Vm8xj08WHLq34pBXnaRSNePdR73oh4dWbdaDin3o=',
    },
    {
      url: 'turn:global.turn.twilio.com:3478?transport=tcp',
      username: '63d97d6ac1466c88184ee201e3610fe2a8cda5ec9e70a9fa30f8c427ab84cf6e',
      urls: 'turn:global.turn.twilio.com:3478?transport=tcp',
      credential: 'Bl5Vm8xj08WHLq34pBXnaRSNePdR73oh4dWbdaDin3o=',
    },
    {
      url: 'turn:global.turn.twilio.com:443?transport=tcp',
      username: '63d97d6ac1466c88184ee201e3610fe2a8cda5ec9e70a9fa30f8c427ab84cf6e',
      urls: 'turn:global.turn.twilio.com:443?transport=tcp',
      credential: 'Bl5Vm8xj08WHLq34pBXnaRSNePdR73oh4dWbdaDin3o=',
    },
  ],
  password: 'Bl5Vm8xj08WHLq34pBXnaRSNePdR73oh4dWbdaDin3o=',
  ttl: '86400',
  username: '63d97d6ac1466c88184ee201e3610fe2a8cda5ec9e70a9fa30f8c427ab84cf6e',
};
