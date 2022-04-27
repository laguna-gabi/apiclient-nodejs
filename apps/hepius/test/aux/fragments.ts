import gql from 'graphql-tag';

export const FRAGMENT_APPOINTMENT = gql`
  fragment appointmentFragment on Appointment {
    id
    userId
    memberId
    notBefore
    status
    method
    start
    end
    noShow
    noShowReason
    recordingConsent
    notes {
      recap
      strengths
      userActionItem
      memberActionItem
      scores {
        adherence
        adherenceText
        wellbeing
        wellbeingText
      }
    }
    updatedAt
    link
  }
`;

export const FRAGMENT_MEMBER_ADMISSION = gql`
  fragment memberAdmissionFragment on MemberAdmission {
    id
    diagnoses {
      id
      icdCode
      description
    }
    procedures {
      id
      date
      procedureType
      text
    }
    medications {
      id
      name
      frequency
      type
      amount {
        amount
        unitType
      }
      startDate
      endDate
      memberNote
      coachNote
    }
    externalAppointments {
      id
      isScheduled
      drName
      instituteOrHospitalName
      date
      phone
      description
      address
    }
    activities {
      id
      text
      isTodo
    }
    woundCares {
      id
      text
    }
    dietaries {
      id
      text
      bmi
    }
  }
`;
