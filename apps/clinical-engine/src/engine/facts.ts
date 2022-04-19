export const memberData = {
  '11111': {
    scheduledAppointments: 0,
    appointmentsToBeScheduled: 0,
    livesAlone: true,
  },
  '22222': {
    scheduledAppointments: 0,
    appointmentsToBeScheduled: 1,
    livesAlone: false,
  },
  '33333': {
    scheduledAppointments: 1,
    appointmentsToBeScheduled: 3,
    livesAlone: false,
  },
};

export const memberCaregivers = {
  '11111': ['x', 'y'],
  '22222': ['x'],
  '33333': ['x', 'y', 'z'],
};

export const memberBarriers = {
  '11111': [{ type: 'appointment-follow-up-unclear' }],
  '22222': [{ type: 'appointment-follow-up-unclear' }],
};
