# Patient Assignment & Cross-User Access System

## Overview
This document explains how the patient assignment system works in the Namibia Health Services application, enabling proper cross-user data access for healthcare coordination.

---

## Data Model

### User Profile (`users/{uid}`)
```javascript
{
  uid: "user123",
  email: "doctor@clinic.na",
  role: "medical_staff", // patient, medical_staff, receptionist, specialist, admin
  fullName: "Dr. Jane Smith",
  surname: "Smith",
  institute: "Windhoek Central Hospital", // Key for institute-based sharing
  profession: "General Practitioner",
  speciality: "Family Medicine",
  assignedDoctor: "", // Only for patients - their assigned doctor's UID
  profilePictureUrl: "https://...",
  createdAt: Timestamp,
  updatedAt: Timestamp,
  lastLoginAt: Timestamp
}
```

### Patient Record (`patients/{patientId}`)
```javascript
{
  // Patient Info
  fullName: "John",
  surname: "Doe",
  dob: "1990-01-15",
  gender: "Male",
  idPassport: "90011512345",
  phone: "081 123 4567",
  insurance: "Yes",
  
  // Cross-User Access Fields
  createdBy: "staff_uid_123",        // Staff who created the record
  createdByEmail: "nurse@clinic.na",
  assignedDoctor: "doctor_uid_456",  // Doctor responsible for this patient
  patientUserId: "patient_uid_789",  // Link to patient's own user account
  institute: "Windhoek Central Hospital", // Institute for group access
  
  // Metadata
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

### Appointment (`appointments/{appointmentId}`)
```javascript
{
  patientId: "patient_uid_123",
  patientUserId: "patient_uid_789",  // For patient's own queries
  patientName: "John",
  patientSurname: "Doe",
  patientDob: "1990-01-15",
  doctorSpecialist: "Dr. Jane Smith",
  date: "2026-07-20",
  time: "10:00",
  reason: "General Check-Up",
  status: "scheduled", // scheduled, completed, cancelled
  createdBy: "staff_uid_123",
  assignedDoctor: "doctor_uid_456",
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

### Prescription (`prescriptions/{prescriptionId}`)
```javascript
{
  patientId: "patient_uid_123",
  patientUserId: "patient_uid_789",
  prescribedBy: "doctor_uid_456",
  prescribedByEmail: "doctor@clinic.na",
  ailment: "Hypertension",
  treatment: "Lifestyle changes + medication",
  prescription: "Amlodipine 5mg daily",
  report: "Patient responding well",
  date: "2026-07-15",
  status: "active",
  createdAt: Timestamp
}
```

---

## Access Control Matrix

| Resource | Patient | Medical Staff | Receptionist | Specialist | Admin |
|----------|---------|---------------|--------------|------------|-------|
| **Own Profile** | ✅ R/W | ✅ R/W | ✅ R/W | ✅ R/W | ✅ R/W |
| **Other Staff Profiles** | ❌ | ✅ R (same institute) | ✅ R (same institute) | ✅ R (same institute) | ✅ R/W |
| **Patients Created by Self** | N/A | ✅ R/W | ✅ R/W | ✅ R/W | ✅ R/W |
| **Patients Assigned to Self** | N/A | ✅ R/W | ✅ R/W | ✅ R/W | ✅ R/W |
| **All Patients (Same Institute)** | N/A | ✅ Read | ✅ Read | ✅ Read | ✅ R/W |
| **Own Appointments** | ✅ R/W | ✅ R/W | ✅ R/W | ✅ R/W | ✅ R/W |
| **Patient Appointments** | Own only | Created/Assigned | Created/Assigned | Created/Assigned | All |
| **Prescriptions** | Own only | Prescribed/Assigned | Institute | Prescribed/Assigned | All |
| **Documents** | Own only | Uploaded/Assigned | Institute | Uploaded/Assigned | All |
| **Billing/Insurance** | Own only | ❌ | ✅ R/W | ❌ | ✅ R/W |
| **Reports** | Own only | Generated/Assigned | Institute | Generated/Assigned | All |

---

## Key Access Patterns

### 1. Patient Self-Service
```javascript
// Patient can only access their own data
// Query by patientUserId matching auth.uid
const patientQuery = query(
  collection(db, 'patients'),
  where('patientUserId', '==', auth.currentUser.uid)
);
```

### 2. Medical Staff - My Patients
```javascript
// Staff sees patients they created
const myPatients = query(
  collection(db, 'patients'),
  where('createdBy', '==', auth.currentUser.uid)
);
```

### 3. Medical Staff - Assigned Patients
```javascript
// Staff sees patients assigned to them as doctor
const assignedPatients = query(
  collection(db, 'patients'),
  where('assignedDoctor', '==', auth.currentUser.uid)
);
```

### 4. Receptionist - Institute Patients
```javascript
// Receptionist sees all patients at their institute
const userProfile = await getUserProfile(auth.currentUser.uid);
const institutePatients = query(
  collection(db, 'patients'),
  where('institute', '==', userProfile.institute)
);
```

### 5. Specialist - Assigned Patients
```javascript
// Specialist sees patients assigned to them
const specialistPatients = query(
  collection(db, 'patients'),
  where('assignedDoctor', '==', auth.currentUser.uid)
);
```

### 6. Cross-Reference Queries

#### Get appointments for a patient (by patient)
```javascript
const patientAppointments = query(
  collection(db, 'appointments'),
  where('patientUserId', '==', auth.currentUser.uid),
  orderBy('date', 'asc')
);
```

#### Get appointments for a patient (by staff)
```javascript
const patientAppointments = query(
  collection(db, 'appointments'),
  where('patientId', '==', patientId),
  orderBy('date', 'asc')
);
```

#### Get prescriptions for a patient
```javascript
const patientPrescriptions = query(
  collection(db, 'prescriptions'),
  where('patientUserId', '==', patientUserId),
  orderBy('date', 'desc')
);
```

---

## Assignment Workflows

### 1. Auto-Assignment on Creation
When staff creates a patient, they're automatically assigned:
```javascript
await addPatient({
  fullName: "John",
  surname: "Doe",
  // ... other fields
  assignedDoctor: auth.currentUser.uid, // Auto-assign to creator
  createdBy: auth.currentUser.uid
});
```

### 2. Manual Re-Assignment
```javascript
// Reassign patient to different doctor
await assignPatientToDoctor(patientId, newDoctorId);

// Also updates patient's user profile if linked
await linkPatientToUser(patientId, patientUserId);
```

### 3. Patient Self-Registration Linking
When patient signs up, link to existing record:
```javascript
// Admin/staff creates patient record first
const patient = await addPatient({...});

// Patient signs up later
// On patient dashboard, they can "Link My Account"
// Calls linkPatientToUser(patientId, patientUserId)
```

---

## Firestore Rules Summary

The rules in `firestore.rules` enforce:

1. **Ownership**: Users own their profile
2. **Creation**: Staff can create patients/appointments
3. **Assignment**: Assigned doctors have full access
4. **Institute Sharing**: Same-institute staff can read
4. **Patient Privacy**: Patients only see own data
5. **Role Enforcement**: Receptionists can bill, specialists can prescribe

Key rule functions:
- `isMedicalStaff()` - role in ['medical_staff', 'specialist']
- `isReceptionist()` - role == 'receptionist'
- `sameInstitute(uid)` - users share institute
- `isPatientCreator(data)` - data.createdBy == auth.uid
- `isAssignedToPatient(data)` - data.assignedDoctor == auth.uid
- `hasPatientAccess(data)` - creator OR assigned OR receptionist OR admin

---

## API Functions for Assignment

```javascript
// In firebase-health-services.js

// Get patients created by current staff
getMyPatients()

// Get patients assigned to current doctor
getAssignedPatients()

// Get all patients at current user's institute
getInstitutePatients()

// Assign patient to doctor
assignPatientToDoctor(patientId, doctorId)

// Link patient record to patient user account
linkPatientToUser(patientId, patientUserId)

// Get patient with full access check
getPatient(patientId) // Rules enforce access
```

---

## UI Implementation

### Patient Card Display
```javascript
// In dashboard, show assignment badge
const patient = allPatients[i];
let badge = '';
if (patient.createdBy === currentUser.uid) {
  badge = '<span class="badge badge-primary">Created by me</span>';
} else if (patient.assignedDoctor === currentUser.uid) {
  badge = '<span class="badge badge-success">Assigned to me</span>';
} else if (patient.institute === currentUserInstitute) {
  badge = '<span class="badge badge-info">Institute patient</span>';
}
```

### Assignment UI
```html
<!-- In patient management modal -->
<select id="assignDoctor" onchange="reassignPatient(patientId, this.value)">
  <option value="">Unassigned</option>
  {{#each doctors}}
    <option value="{{uid}}" {{#if selected}}selected{{/if}}>
      Dr. {{fullName}} ({{profession}})
    </option>
  {{/each}}
</select>
```

---

## Best Practices

1. **Always set `institute`** on user profiles for institute-based sharing
2. **Use `assignedDoctor`** for explicit doctor-patient relationships
3. **Link `patientUserId`** when patient creates account for self-service
4. **Set `createdBy`** on all resources for audit trail
5. **Use batch writes** for atomic operations (e.g., create patient + link)
6. **Index properly** in Firestore for query performance

### Required Firestore Indexes
```json
// patients collection
{"fields": [{"fieldPath": "createdBy"}, {"fieldPath": "createdAt"}], "queryScope": "COLLECTION"}
{"fields": [{"fieldPath": "assignedDoctor"}, {"fieldPath": "createdAt"}], "queryScope": "COLLECTION"}
{"fields": [{"fieldPath": "institute"}, {"fieldPath": "createdAt"}], "queryScope": "COLLECTION"}
{"fields": [{"fieldPath": "patientUserId"}, {"fieldPath": "createdAt"}], "queryScope": "COLLECTION"}

// appointments collection
{"fields": [{"fieldPath": "createdBy"}, {"fieldPath": "date"}, {"fieldPath": "time"}], "queryScope": "COLLECTION"}
{"fields": [{"fieldPath": "patientUserId"}, {"fieldPath": "date"}], "queryScope": "COLLECTION"}
{"fields": [{"fieldPath": "patientId"}, {"fieldPath": "date"}], "queryScope": "COLLECTION"}

// prescriptions collection
{"fields": [{"fieldPath": "prescribedBy"}, {"fieldPath": "date"}], "queryScope": "COLLECTION"}
{"fields": [{"fieldPath": "patientUserId"}, {"fieldPath": "date"}], "queryScope": "COLLECTION"}
```

---

## Migration Notes

If migrating from localStorage-only system:

1. **Export localStorage data** from each user's browser
2. **Transform to Firestore schema** adding:
   - `createdBy` (staff email/UID)
   - `assignedDoctor` (default to creator)
   - `patientUserId` (link to patient auth account)
   - `institute` (staff's institute)
3. **Batch import** to Firestore
3. **Verify access** with test accounts

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Patient not visible | Check `assignedDoctor`, `createdBy`, `institute` fields |
| Permission denied | Verify user has `institute` set in profile |
| Patient can't see own data | Ensure `patientUserId` matches auth UID |
| Cross-institute access failing | Confirm both users have same `institute` value |
| Queries failing | Create required Firestore indexes |

---

*Last Updated: 2026-07-23*
*Version: 1.0.0*