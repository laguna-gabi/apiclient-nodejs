import gql from 'graphql-tag';

export const FRAGMENT_MEMBER = gql`
  fragment memberFragment on Member {
    id
    authId
    phone
    phoneType
    deviceId
    firstName
    lastName
    dateOfBirth
    address {
      street
      city
      state
    }
    scores {
      adherence
      adherenceText
      wellbeing
      wellbeingText
    }
    org {
      id
      name
      type
      trialDuration
      zipCode
    }
    primaryUserId
    users {
      id
      firstName
      lastName
      email
      roles
      avatar
      description
      createdAt
      phone
      title
      maxMembers
      languages
      appointments {
        id
        notBefore
        method
        status
        start
        end
        link
        noShow
        noShowReason
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
      }
    }
    sex
    email
    zipCode
    utcDelta
    dischargeDate
    actionItems {
      id
      title
      status
      deadline
    }
    fellowName
    drg
    authId
    healthPlan
    preferredGenderPronoun
    drgDesc
    phoneSecondary
    phoneSecondaryType
    generalNotes
    nurseNotes
    admitDate
    createdAt
    honorific
    healthPersona
    readmissionRisk
    readmissionRiskHistory {
      readmissionRisk
      date
    }
    isGraduated
    graduationDate
    maritalStatus
    height
    weight
    deceased {
      cause
      date
    }
  }
`;

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

export const FRAGMENT_ADMISSION = gql`
  fragment admissionFragment on Admission {
    id
    admitDate
    dischargeDate
    diagnoses {
      id
      code
      description
      primaryType
      secondaryType
      clinicalStatus
      severity
      onsetStart
      onsetEnd
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
      clinic
      date
      type
      specialInstructions
      fullAddress
      phone
      fax
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
