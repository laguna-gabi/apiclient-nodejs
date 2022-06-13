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
    org {
      id
      name
      type
      trialDuration
      zipCode
      code
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
    fellowName
    drg
    authId
    healthPlan
    preferredGenderPronoun
    drgDesc
    phoneSecondary
    phoneSecondaryType
    admitDate
    createdAt
    honorific
    healthPersona
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
    admitType
    admitSource
    dischargeDate
    dischargeTo
    facility
    specialInstructions
    reasonForAdmission
    hospitalCourse
    admissionSummary
    drg
    drgDesc
    nurseNotes
    warningSigns
    createdAt
    updatedAt
    activity {
      general
      lifting
      showerOrBathing
      stairs
      driving
      sexualActivity
      work
    }
    woundCare {
      general
    }
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
    treatmentRendereds {
      code
      startDate
      endDate
    }
    medications {
      id
      status
      name
      route
      dosage
      frequency
      startDate
      endDate
      specialInstructions
    }
    externalAppointments {
      id
      status
      drName
      clinic
      date
      type
      specialInstructions
      fullAddress
      phone
      fax
    }
    dietaries {
      id
      category
      name
      date
      notes
    }
  }
`;

export const FRAGMENT_JOURNEY = gql`
  fragment journeyFragment on Journey {
    id
    memberId
    fellowName
    readmissionRisk
    readmissionRiskHistory {
      readmissionRisk
      date
    }
    firstLoggedInAt
    isGraduated
    graduationDate
    generalNotes
    scores {
      adherence
      adherenceText
      wellbeing
      wellbeingText
    }
  }
`;
