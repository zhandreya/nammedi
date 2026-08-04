/**
 * Namibia Health Services - Firebase Backend Module
 * Complete backend with patient assignment & cross-user access support
 * 
 * Collections Structure:
 * - users/{uid} - User profiles with role, institute, assignedDoctor
 * - patients/{patientId} - Patient records with createdBy, assignedDoctor, patientUserId, institute
 * - appointments/{appointmentId} - Appointments with createdBy, patientUserId, assignedDoctor
 * - prescriptions/{prescriptionId} - Prescriptions with prescribedBy, patientUserId
 * - documents/{documentId} - Documents with uploadedBy, patientId
 * - medicationRecords/{recordId} - Medication admin records
 * - medicationInventory/{inventoryId} - Per-staff or institute inventory
 * - tasks/{taskId} - Staff tasks
 * - reminders/{reminderId} - Staff reminders
 * - emergencyContacts/{contactId} - User emergency contacts
 * - medicalInfo/{userId} - Patient medical info
 * - reports/{reportId} - Generated reports
 * - insuranceVerifications/{verificationId} - Insurance checks
 * - invoices/{invoiceId} - Billing invoices
 * - payments/{paymentId} - Payment records
 * - claims/{claimId} - Insurance claims
 * - refillRequests/{requestId} - Prescription refill requests
 * - ailmentsTreatments/{recordId} - Ailment/treatment records
 * - institutesVisited/{visitId} - Patient visit history
 * - checkIns/{checkInId} - Patient check-ins
 */

// ============================================================================
// FIREBASE CONFIGURATION - IMPORTED FROM firebase-config.js
// ============================================================================
import { firebaseConfig } from './firebase-config.js';

// ============================================================================
// FIREBASE INITIALIZATION
// ============================================================================
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { 
    getAuth, 
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut as firebaseSignOut,
    onAuthStateChanged,
    updateProfile,
    sendPasswordResetEmail,
    updateEmail,
    updatePassword,
    reauthenticateWithCredential,
    EmailAuthProvider
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { 
    getFirestore, 
    doc, 
    getDoc, 
    setDoc, 
    updateDoc, 
    deleteDoc,
    serverTimestamp,
    collection,
    query,
    where,
    getDocs,
    orderBy,
    limit,
    addDoc,
    arrayUnion,
    arrayRemove,
    writeBatch,
    runTransaction
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { 
    getStorage, 
    ref, 
    uploadBytes, 
    getDownloadURL,
    deleteObject
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

// ============================================================================
// COLLECTION NAMES
// ============================================================================
const COLLECTIONS = {
    USERS: 'users',
    PATIENTS: 'patients',
    APPOINTMENTS: 'appointments',
    DOCUMENTS: 'documents',
    MEDICATION_RECORDS: 'medicationRecords',
    MEDICATION_INVENTORY: 'medicationInventory',
    TASKS: 'tasks',
    REMINDERS: 'reminders',
    EMERGENCY_CONTACTS: 'emergencyContacts',
    MEDICAL_INFO: 'medicalInfo',
    PRESCRIPTIONS: 'prescriptions',
    REPORTS: 'reports',
    INSURANCE_VERIFICATIONS: 'insuranceVerifications',
    INVOICES: 'invoices',
    PAYMENTS: 'payments',
    CLAIMS: 'claims',
    REFILL_REQUESTS: 'refillRequests',
    AILMENTS_TREATMENTS: 'ailmentsTreatments',
    INSTITUTES_VISITED: 'institutesVisited',
    CHECK_INS: 'checkIns'
};

// ============================================================================
// USER ROLES
// ============================================================================
export const USER_ROLES = {
    PATIENT: 'patient',
    MEDICAL_STAFF: 'medical_staff',
    RECEPTIONIST: 'receptionist',
    SPECIALIST: 'specialist',
    ADMIN: 'admin'
};

// ============================================================================
// AUTHENTICATION FUNCTIONS
// ============================================================================

/**
 * Sign up new user with role and profile data
 */
export async function signUp(email, password, profileData = {}) {
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // Update auth profile
        if (profileData.fullName) {
            await updateProfile(user, { displayName: profileData.fullName });
        }

        // Create user document in Firestore
        await createUserProfile(user.uid, {
            email,
            role: profileData.role || USER_ROLES.PATIENT,
            ...profileData,
            createdAt: serverTimestamp()
        });

        return userCredential;
    } catch (error) {
        throw new Error(getAuthErrorMessage(error.code));
    }
}

/**
 * Sign in existing user
 */
export async function signIn(email, password) {
    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        await updateLastLogin(userCredential.user.uid);
        return userCredential;
    } catch (error) {
        throw new Error(getAuthErrorMessage(error.code));
    }
}

/**
 * Sign out current user
 */
export async function signOut() {
    try {
        await firebaseSignOut(auth);
    } catch (error) {
        throw new Error('Failed to sign out. Please try again.');
    }
}

/**
 * Send password reset email
 */
export async function resetPassword(email) {
    try {
        await sendPasswordResetEmail(auth, email);
    } catch (error) {
        throw new Error(getAuthErrorMessage(error.code));
    }
}

/**
 * Change user email (requires recent login)
 */
export async function changeEmail(newEmail, currentPassword) {
    const user = auth.currentUser;
    if (!user) throw new Error('Not authenticated');
    
    const credential = EmailAuthProvider.credential(user.email, currentPassword);
    await reauthenticateWithCredential(user, credential);
    await updateEmail(user, newEmail);
    
    // Update Firestore
    await updateUserProfile(user.uid, { email: newEmail });
}

/**
 * Change user password (requires recent login)
 */
export async function changePassword(currentPassword, newPassword) {
    const user = auth.currentUser;
    if (!user) throw new Error('Not authenticated');
    
    const credential = EmailAuthProvider.credential(user.email, currentPassword);
    await reauthenticateWithCredential(user, credential);
    await updatePassword(user, newPassword);
}

/**
 * Get current authenticated user
 */
export function getCurrentUser() {
    return auth.currentUser;
}

/**
 * Subscribe to auth state changes
 */
export function onAuthChange(callback) {
    return onAuthStateChanged(auth, callback);
}

// ============================================================================
// USER PROFILE FUNCTIONS
// ============================================================================

/**
 * Create initial user profile in Firestore
 */
export async function createUserProfile(uid, data) {
    const userRef = doc(db, COLLECTIONS.USERS, uid);
    const profileData = {
        uid,
        email: data.email || '',
        role: data.role || USER_ROLES.PATIENT,
        fullName: data.fullName || '',
        surname: data.surname || '',
        dob: data.dob || '',
        gender: data.gender || '',
        idPassport: data.idPassport || '',
        phone: data.phone || data.cellPhone || data.workTel || '',
        workTel: data.workTel || '',
        profession: data.profession || data.speciality || '',
        institute: data.institute || data.institution || '',
        placeOfBirth: data.placeOfBirth || '',
        username: data.username || '',
        speciality: data.speciality || '',
        assignedDoctor: data.assignedDoctor || '', // For patients - their assigned doctor
        profilePictureUrl: data.profilePictureUrl || '',
        profilePicture: data.profilePicture || '', // base64 fallback
        createdAt: data.createdAt || serverTimestamp(),
        updatedAt: serverTimestamp(),
        lastLoginAt: serverTimestamp()
    };
    await setDoc(userRef, profileData);
    return profileData;
}

/**
 * Get user profile from Firestore
 */
export async function getUserProfile(uid) {
    const userRef = doc(db, COLLECTIONS.USERS, uid);
    const userSnap = await getDoc(userRef);
    return userSnap.exists() ? { id: userSnap.id, ...userSnap.data() } : null;
}

/**
 * Update user profile
 */
export async function updateUserProfile(uid, data) {
    const userRef = doc(db, COLLECTIONS.USERS, uid);
    await updateDoc(userRef, {
        ...data,
        updatedAt: serverTimestamp()
    });
}

/**
 * Update last login timestamp
 */
export async function updateLastLogin(uid) {
    const userRef = doc(db, COLLECTIONS.USERS, uid);
    await updateDoc(userRef, { lastLoginAt: serverTimestamp() });
}

/**
 * Upload profile picture to Firebase Storage
 */
export async function uploadProfilePicture(uid, file) {
    const storageRef = ref(storage, `profile-pictures/${uid}/${Date.now()}_${file.name}`);
    await uploadBytes(storageRef, file);
    const downloadUrl = await getDownloadURL(storageRef);
    await updateUserProfile(uid, { profilePictureUrl: downloadUrl });
    return downloadUrl;
}

// ============================================================================
// PATIENT FUNCTIONS (with assignment support)
// ============================================================================

/**
 * Add a new patient (linked to current staff user)
 * @param {Object} patientData - Patient data including optional assignedDoctor
 */
export async function addPatient(patientData) {
    const user = getCurrentUser();
    if (!user) throw new Error('Not authenticated');

    const patientsRef = collection(db, COLLECTIONS.PATIENTS);
    const patientDoc = await addDoc(patientsRef, {
        ...patientData,
        createdBy: user.uid,
        createdByEmail: user.email,
        institute: patientData.institute || '', // Staff's institute
        patientUserId: patientData.patientUserId || '', // Link to patient's user account
        assignedDoctor: patientData.assignedDoctor || user.uid, // Assign to creator by default
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
    });

    return { id: patientDoc.id, ...patientData };
}

/**
 * Get patients created by current user
 */
export async function getMyPatients() {
    const user = getCurrentUser();
    if (!user) throw new Error('Not authenticated');

    const patientsRef = collection(db, COLLECTIONS.PATIENTS);
    const q = query(
        patientsRef,
        where('createdBy', '==', user.uid),
        orderBy('createdAt', 'desc')
    );
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

/**
 * Get patients assigned to current user (as doctor)
 */
export async function getAssignedPatients() {
    const user = getCurrentUser();
    if (!user) throw new Error('Not authenticated');

    const patientsRef = collection(db, COLLECTIONS.PATIENTS);
    const q = query(
        patientsRef,
        where('assignedDoctor', '==', user.uid),
        orderBy('createdAt', 'desc')
    );
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

/**
 * Get all patients at current user's institute (for receptionists/medical staff)
 */
export async function getInstitutePatients() {
    const user = getCurrentUser();
    if (!user) throw new Error('Not authenticated');

    const userProfile = await getUserProfile(user.uid);
    if (!userProfile || !userProfile.institute) {
        throw new Error('User has no institute assigned');
    }

    const patientsRef = collection(db, COLLECTIONS.PATIENTS);
    const q = query(
        patientsRef,
        where('institute', '==', userProfile.institute),
        orderBy('createdAt', 'desc')
    );
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

/**
 * Get patient by ID
 */
export async function getPatient(patientId) {
    const patientRef = doc(db, COLLECTIONS.PATIENTS, patientId);
    const snap = await getDoc(patientRef);
    return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

/**
 * Update patient (with assignment support)
 */
export async function updatePatient(patientId, data) {
    const patientRef = doc(db, COLLECTIONS.PATIENTS, patientId);
    await updateDoc(patientRef, {
        ...data,
        updatedAt: serverTimestamp()
    });
}

/**
 * Assign patient to a doctor
 */
export async function assignPatientToDoctor(patientId, doctorId) {
    const patientRef = doc(db, COLLECTIONS.PATIENTS, patientId);
    await updateDoc(patientRef, {
        assignedDoctor: doctorId,
        updatedAt: serverTimestamp()
    });
    
    // Also update patient's user profile if they have one
    const patient = await getPatient(patientId);
    if (patient && patient.patientUserId) {
        await updateUserProfile(patient.patientUserId, { assignedDoctor: doctorId });
    }
}

/**
 * Link patient record to patient user account
 */
export async function linkPatientToUser(patientId, patientUserId) {
    const patientRef = doc(db, COLLECTIONS.PATIENTS, patientId);
    await updateDoc(patientRef, {
        patientUserId: patientUserId,
        updatedAt: serverTimestamp()
    });
    
    // Update patient's user profile
    await updateUserProfile(patientUserId, { 
        assignedDoctor: (await getPatient(patientId)).assignedDoctor 
    });
}

/**
 * Delete patient
 */
export async function deletePatient(patientId) {
    const patientRef = doc(db, COLLECTIONS.PATIENTS, patientId);
    await deleteDoc(patientRef);
}

/**
 * Search patients by name, ID, phone
 */
export async function searchPatients(searchTerm) {
    const patients = await getMyPatients();
    const term = searchTerm.toLowerCase();
    return patients.filter(p => 
        (p.fullName?.toLowerCase().includes(term)) ||
        (p.surname?.toLowerCase().includes(term)) ||
        (p.idPassport?.includes(term)) ||
        (p.cellphone?.includes(term)) ||
        (p.phone?.includes(term))
    );
}

// ============================================================================
// APPOINTMENT FUNCTIONS (with patient linking)
// ============================================================================

/**
 * Create appointment
 */
export async function createAppointment(appointmentData) {
    const user = getCurrentUser();
    if (!user) throw new Error('Not authenticated');

    const appointmentsRef = collection(db, COLLECTIONS.APPOINTMENTS);
    const apptDoc = await addDoc(appointmentsRef, {
        ...appointmentData,
        createdBy: user.uid,
        createdByEmail: user.email,
        status: appointmentData.status || 'scheduled',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
    });

    return { id: apptDoc.id, ...appointmentData };
}

/**
 * Get appointments for current user
 */
export async function getMyAppointments() {
    const user = getCurrentUser();
    if (!user) throw new Error('Not authenticated');

    const appointmentsRef = collection(db, COLLECTIONS.APPOINTMENTS);
    const q = query(
        appointmentsRef,
        where('createdBy', '==', user.uid),
        orderBy('date', 'asc'),
        orderBy('time', 'asc')
    );
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

/**
 * Get appointments for a specific patient
 */
export async function getPatientAppointments(patientId) {
    const appointmentsRef = collection(db, COLLECTIONS.APPOINTMENTS);
    const q = query(
        appointmentsRef,
        where('patientId', '==', patientId),
        orderBy('date', 'asc')
    );
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

/**
 * Get upcoming appointments
 */
export async function getUpcomingAppointments(days = 30) {
    const appointments = await getMyAppointments();
    const now = new Date();
    const future = new Date();
    future.setDate(now.getDate() + days);
    
    return appointments.filter(apt => {
        const aptDate = new Date(apt.date);
        return aptDate >= now && aptDate <= future && apt.status === 'scheduled';
    });
}

/**
 * Update appointment
 */
export async function updateAppointment(appointmentId, data) {
    const apptRef = doc(db, COLLECTIONS.APPOINTMENTS, appointmentId);
    await updateDoc(apptRef, {
        ...data,
        updatedAt: serverTimestamp()
    });
}

/**
 * Delete appointment
 */
export async function deleteAppointment(appointmentId) {
    const apptRef = doc(db, COLLECTIONS.APPOINTMENTS, appointmentId);
    await deleteDoc(apptRef);
}

// ============================================================================
// DOCUMENT FUNCTIONS
// ============================================================================

/**
 * Upload document for a patient
 */
export async function uploadDocument(patientId, file, category = 'general') {
    const user = getCurrentUser();
    if (!user) throw new Error('Not authenticated');

    // Upload to Firebase Storage
    const storageRef = ref(storage, `documents/${user.uid}/${patientId}/${Date.now()}_${file.name}`);
    await uploadBytes(storageRef, file);
    const fileUrl = await getDownloadURL(storageRef);

    // Save metadata to Firestore
    const documentsRef = collection(db, COLLECTIONS.DOCUMENTS);
    const docRef = await addDoc(documentsRef, {
        patientId,
        patientUserId: (await getPatient(patientId))?.patientUserId || '',
        fileName: file.name,
        fileUrl,
        fileSize: file.size,
        fileType: file.type,
        category,
        uploadedBy: user.uid,
        uploadedByEmail: user.email,
        uploadDate: new Date().toISOString().split('T')[0],
        createdAt: serverTimestamp()
    });

    return { id: docRef.id, fileName: file.name, fileUrl, category };
}

/**
 * Get documents for a patient
 */
export async function getPatientDocuments(patientId) {
    const documentsRef = collection(db, COLLECTIONS.DOCUMENTS);
    const q = query(
        documentsRef,
        where('patientId', '==', patientId),
        orderBy('createdAt', 'desc')
    );
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

/**
 * Get all documents uploaded by current user
 */
export async function getMyDocuments() {
    const user = getCurrentUser();
    if (!user) throw new Error('Not authenticated');

    const documentsRef = collection(db, COLLECTIONS.DOCUMENTS);
    const q = query(
        documentsRef,
        where('uploadedBy', '==', user.uid),
        orderBy('createdAt', 'desc')
    );
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

/**
 * Delete document
 */
export async function deleteDocument(documentId) {
    const docRef = doc(db, COLLECTIONS.DOCUMENTS, documentId);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
        const data = snap.data();
        try {
            const storageRef = ref(storage, data.fileUrl);
            await deleteObject(storageRef);
        } catch (e) {
            console.warn('Could not delete from storage:', e);
        }
        await deleteDoc(docRef);
    }
}

// ============================================================================
// MEDICATION FUNCTIONS
// ============================================================================

/**
 * Record medication administration
 */
export async function recordMedicationAdministration(medData) {
    const user = getCurrentUser();
    if (!user) throw new Error('Not authenticated');

    const medRef = collection(db, COLLECTIONS.MEDICATION_RECORDS);
    const docRef = await addDoc(medRef, {
        ...medData,
        administeredBy: user.uid,
        administeredByEmail: user.email,
        createdAt: serverTimestamp()
    });

    return { id: docRef.id, ...medData };
}

/**
 * Get medication records by current user
 */
export async function getMyMedicationRecords() {
    const user = getCurrentUser();
    if (!user) throw new Error('Not authenticated');

    const medRef = collection(db, COLLECTIONS.MEDICATION_RECORDS);
    const q = query(
        medRef,
        where('administeredBy', '==', user.uid),
        orderBy('createdAt', 'desc')
    );
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

/**
 * Update medication inventory
 */
export async function updateMedicationInventory(inventoryData) {
    const user = getCurrentUser();
    if (!user) throw new Error('Not authenticated');

    const invRef = doc(db, COLLECTIONS.MEDICATION_INVENTORY, user.uid);
    await setDoc(invRef, {
        ...inventoryData,
        updatedBy: user.uid,
        updatedAt: serverTimestamp()
    }, { merge: true });
}

export async function getMedicationInventory() {
    const user = getCurrentUser();
    if (!user) throw new Error('Not authenticated');

    const invRef = doc(db, COLLECTIONS.MEDICATION_INVENTORY, user.uid);
    const snap = await getDoc(invRef);
    return snap.exists() ? snap.data() : null;
}

// ============================================================================
// PRESCRIPTION FUNCTIONS
// ============================================================================

/**
 * Add prescription
 */
export async function addPrescription(prescriptionData) {
    const user = getCurrentUser();
    if (!user) throw new Error('Not authenticated');

    const prescRef = collection(db, COLLECTIONS.PRESCRIPTIONS);
    const docRef = await addDoc(prescRef, {
        ...prescriptionData,
        prescribedBy: user.uid,
        prescribedByEmail: user.email,
        patientUserId: prescriptionData.patientUserId || '',
        createdAt: serverTimestamp()
    });

    return { id: docRef.id, ...prescriptionData };
}

/**
 * Get prescriptions by current user (as prescriber)
 */
export async function getMyPrescriptions() {
    const user = getCurrentUser();
    if (!user) throw new Error('Not authenticated');

    const prescRef = collection(db, COLLECTIONS.PRESCRIPTIONS);
    const q = query(
        prescRef,
        where('prescribedBy', '==', user.uid),
        orderBy('createdAt', 'desc')
    );
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

/**
 * Get prescriptions for a specific patient
 */
export async function getPatientPrescriptions(patientUserId) {
    const prescRef = collection(db, COLLECTIONS.PRESCRIPTIONS);
    const q = query(
        prescRef,
        where('patientUserId', '==', patientUserId),
        orderBy('createdAt', 'desc')
    );
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

// ============================================================================
// TASK & REMINDER FUNCTIONS
// ============================================================================

export async function addTask(taskData) {
    const user = getCurrentUser();
    if (!user) throw new Error('Not authenticated');

    const tasksRef = collection(db, COLLECTIONS.TASKS);
    const docRef = await addDoc(tasksRef, {
        ...taskData,
        userId: user.uid,
        completed: false,
        createdAt: serverTimestamp()
    });

    return { id: docRef.id, ...taskData };
}

export async function getMyTasks() {
    const user = getCurrentUser();
    if (!user) throw new Error('Not authenticated');

    const tasksRef = collection(db, COLLECTIONS.TASKS);
    const q = query(
        tasksRef,
        where('userId', '==', user.uid),
        orderBy('createdAt', 'desc')
    );
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

export async function updateTask(taskId, data) {
    const taskRef = doc(db, COLLECTIONS.TASKS, taskId);
    await updateDoc(taskRef, data);
}

export async function deleteTask(taskId) {
    const taskRef = doc(db, COLLECTIONS.TASKS, taskId);
    await deleteDoc(taskRef);
}

export async function addReminder(reminderData) {
    const user = getCurrentUser();
    if (!user) throw new Error('Not authenticated');

    const remindersRef = collection(db, COLLECTIONS.REMINDERS);
    const docRef = await addDoc(remindersRef, {
        ...reminderData,
        userId: user.uid,
        createdAt: serverTimestamp()
    });

    return { id: docRef.id, ...reminderData };
}

export async function getMyReminders() {
    const user = getCurrentUser();
    if (!user) throw new Error('Not authenticated');

    const remindersRef = collection(db, COLLECTIONS.REMINDERS);
    const q = query(
        remindersRef,
        where('userId', '==', user.uid),
        orderBy('date', 'asc'),
        orderBy('time', 'asc')
    );
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

export async function getTodaysReminders() {
    const reminders = await getMyReminders();
    const today = new Date().toISOString().split('T')[0];
    return reminders.filter(r => r.date === today);
}

// ============================================================================
// EMERGENCY CONTACTS
// ============================================================================

export async function addEmergencyContact(contactData) {
    const user = getCurrentUser();
    if (!user) throw new Error('Not authenticated');

    const contactsRef = collection(db, COLLECTIONS.EMERGENCY_CONTACTS);
    const docRef = await addDoc(contactsRef, {
        ...contactData,
        userId: user.uid,
        createdAt: serverTimestamp()
    });

    return { id: docRef.id, ...contactData };
}

export async function getEmergencyContacts() {
    const user = getCurrentUser();
    if (!user) throw new Error('Not authenticated');

    const contactsRef = collection(db, COLLECTIONS.EMERGENCY_CONTACTS);
    const q = query(contactsRef, where('userId', '==', user.uid));
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

export async function updateEmergencyContact(contactId, data) {
    const contactRef = doc(db, COLLECTIONS.EMERGENCY_CONTACTS, contactId);
    await updateDoc(contactRef, data);
}

export async function deleteEmergencyContact(contactId) {
    const contactRef = doc(db, COLLECTIONS.EMERGENCY_CONTACTS, contactId);
    await deleteDoc(contactRef);
}

// ============================================================================
// MEDICAL INFO (Patient)
// ============================================================================

export async function saveMedicalInfo(medicalData) {
    const user = getCurrentUser();
    if (!user) throw new Error('Not authenticated');

    const medRef = doc(db, COLLECTIONS.MEDICAL_INFO, user.uid);
    await setDoc(medRef, {
        userId: user.uid,
        ...medicalData,
        updatedAt: serverTimestamp()
    }, { merge: true });
}

export async function getMedicalInfo() {
    const user = getCurrentUser();
    if (!user) throw new Error('Not authenticated');

    const medRef = doc(db, COLLECTIONS.MEDICAL_INFO, user.uid);
    const snap = await getDoc(medRef);
    return snap.exists() ? snap.data() : null;
}

// ============================================================================
// REPORTS
// ============================================================================

export async function generateReport(reportData) {
    const user = getCurrentUser();
    if (!user) throw new Error('Not authenticated');

    const reportsRef = collection(db, COLLECTIONS.REPORTS);
    const docRef = await addDoc(reportsRef, {
        ...reportData,
        generatedBy: user.uid,
        generatedByEmail: user.email,
        createdAt: serverTimestamp()
    });

    return { id: docRef.id, ...reportData };
}

export async function getMyReports() {
    const user = getCurrentUser();
    if (!user) throw new Error('Not authenticated');

    const reportsRef = collection(db, COLLECTIONS.REPORTS);
    const q = query(
        reportsRef,
        where('generatedBy', '==', user.uid),
        orderBy('createdAt', 'desc')
    );
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

// ============================================================================
// INSURANCE & BILLING (Receptionist)
// ============================================================================

export async function verifyInsurance(insuranceData) {
    const user = getCurrentUser();
    if (!user) throw new Error('Not authenticated');

    const verifyRef = collection(db, COLLECTIONS.INSURANCE_VERIFICATIONS);
    const docRef = await addDoc(verifyRef, {
        ...insuranceData,
        verifiedBy: user.uid,
        verifiedByEmail: user.email,
        createdAt: serverTimestamp()
    });

    return { id: docRef.id, ...insuranceData };
}

export async function createInvoice(invoiceData) {
    const user = getCurrentUser();
    if (!user) throw new Error('Not authenticated');

    const invoiceRef = collection(db, COLLECTIONS.INVOICES);
    const docRef = await addDoc(invoiceRef, {
        ...invoiceData,
        createdBy: user.uid,
        createdByEmail: user.email,
        status: invoiceData.status || 'pending',
        createdAt: serverTimestamp()
    });

    return { id: docRef.id, ...invoiceData };
}

export async function processPayment(paymentData) {
    const user = getCurrentUser();
    if (!user) throw new Error('Not authenticated');

    const paymentRef = collection(db, COLLECTIONS.PAYMENTS);
    const docRef = await addDoc(paymentRef, {
        ...paymentData,
        processedBy: user.uid,
        processedByEmail: user.email,
        createdAt: serverTimestamp()
    });

    return { id: docRef.id, ...paymentData };
}

export async function createClaim(claimData) {
    const user = getCurrentUser();
    if (!user) throw new Error('Not authenticated');

    const claimsRef = collection(db, COLLECTIONS.CLAIMS);
    const docRef = await addDoc(claimsRef, {
        ...claimData,
        createdBy: user.uid,
        createdByEmail: user.email,
        status: claimData.status || 'submitted',
        createdAt: serverTimestamp()
    });

    return { id: docRef.id, ...claimData };
}

// ============================================================================
// PATIENT-SPECIFIC FUNCTIONS
// ============================================================================

export async function addAilmentTreatment(ailmentData) {
    const user = getCurrentUser();
    if (!user) throw new Error('Not authenticated');

    const ailmentRef = collection(db, COLLECTIONS.AILMENTS_TREATMENTS);
    const docRef = await addDoc(ailmentRef, {
        ...ailmentData,
        patientId: user.uid,
        recordedBy: user.uid,
        createdAt: serverTimestamp()
    });

    return { id: docRef.id, ...ailmentData };
}

export async function getMyAilmentsTreatments() {
    const user = getCurrentUser();
    if (!user) throw new Error('Not authenticated');

    const ailmentRef = collection(db, COLLECTIONS.AILMENTS_TREATMENTS);
    const q = query(
        ailmentRef,
        where('patientId', '==', user.uid),
        orderBy('createdAt', 'desc')
    );
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

export async function addInstituteVisited(instituteData) {
    const user = getCurrentUser();
    if (!user) throw new Error('Not authenticated');

    const instRef = collection(db, COLLECTIONS.INSTITUTES_VISITED);
    const docRef = await addDoc(instRef, {
        ...instituteData,
        patientId: user.uid,
        createdAt: serverTimestamp()
    });

    return { id: docRef.id, ...instituteData };
}

export async function getMyInstitutesVisited() {
    const user = getCurrentUser();
    if (!user) throw new Error('Not authenticated');

    const instRef = collection(db, COLLECTIONS.INSTITUTES_VISITED);
    const q = query(
        instRef,
        where('patientId', '==', user.uid),
        orderBy('createdAt', 'desc')
    );
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

export async function requestRefill(refillData) {
    const user = getCurrentUser();
    if (!user) throw new Error('Not authenticated');

    const refillRef = collection(db, COLLECTIONS.REFILL_REQUESTS);
    const docRef = await addDoc(refillRef, {
        ...refillData,
        patientId: user.uid,
        patientEmail: user.email,
        status: 'pending',
        createdAt: serverTimestamp()
    });

    return { id: docRef.id, ...refillData };
}

export async function getMyRefillRequests() {
    const user = getCurrentUser();
    if (!user) throw new Error('Not authenticated');

    const refillRef = collection(db, COLLECTIONS.REFILL_REQUESTS);
    const q = query(
        refillRef,
        where('patientId', '==', user.uid),
        orderBy('createdAt', 'desc')
    );
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

// ============================================================================
// CHECK-IN (Receptionist/Medical Staff)
// ============================================================================

export async function checkInPatient(checkInData) {
    const user = getCurrentUser();
    if (!user) throw new Error('Not authenticated');

    const checkInRef = collection(db, COLLECTIONS.CHECK_INS);
    const docRef = await addDoc(checkInRef, {
        ...checkInData,
        checkedInBy: user.uid,
        checkedInByEmail: user.email,
        createdAt: serverTimestamp()
    });

    return { id: docRef.id, ...checkInData };
}

export async function getMyCheckIns() {
    const user = getCurrentUser();
    if (!user) throw new Error('Not authenticated');

    const checkInRef = collection(db, COLLECTIONS.CHECK_INS);
    const q = query(
        checkInRef,
        where('checkedInBy', '==', user.uid),
        orderBy('createdAt', 'desc')
    );
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

export function formatTimestamp(timestamp) {
    if (!timestamp) return 'Never';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleString('en-NA', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

export function formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-NA');
}

export function formatTime(timeString) {
    if (!timeString) return '';
    return timeString;
}

export function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function isValidNamibianPhone(phone) {
    return /^(\+264|0)[6-8][0-9]{7}$/.test(phone.replace(/\s/g, ''));
}

export function isValidNamibianId(id) {
    return /^\d{11}$/.test(id.replace(/\s/g, ''));
}

function getAuthErrorMessage(code) {
    const messages = {
        'auth/email-already-in-use': 'This email is already registered.',
        'auth/invalid-email': 'Please enter a valid email address.',
        'auth/weak-password': 'Password should be at least 6 characters.',
        'auth/user-not-found': 'No account found with this email.',
        'auth/wrong-password': 'Incorrect password.',
        'auth/too-many-requests': 'Too many attempts. Please try again later.',
        'auth/network-request-failed': 'Network error. Please check your connection.',
        'auth/user-disabled': 'This account has been disabled.',
        'auth/operation-not-allowed': 'This sign-in method is not enabled.',
        'auth/invalid-credential': 'Invalid credentials provided.',
        'auth/requires-recent-login': 'Please sign in again to make this change.'
    };
    return messages[code] || 'An error occurred. Please try again.';
}

// ============================================================================
// INACTIVITY TIMEOUT MANAGER
// ============================================================================

let inactivityTimeout = null;
const DEFAULT_INACTIVITY_MS = 60 * 60 * 1000; // 1 hour

export function initInactivityTimer(timeoutMs = DEFAULT_INACTIVITY_MS, onTimeout = () => signOut()) {
    const events = ['load', 'mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
    
    function resetTimer() {
        clearTimeout(inactivityTimeout);
        inactivityTimeout = setTimeout(onTimeout, timeoutMs);
    }

    events.forEach(event => {
        window.addEventListener(event, resetTimer, { passive: true });
    });

    resetTimer();

    return () => {
        clearTimeout(inactivityTimeout);
        events.forEach(event => {
            window.removeEventListener(event, resetTimer);
        });
    };
}

// ============================================================================
// TOAST NOTIFICATIONS
// ============================================================================

export function showToast(message, type = 'info', duration = 4000) {
    let toast = document.getElementById('globalToast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'globalToast';
        toast.style.cssText = `
            position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%) translateY(100px);
            padding: 14px 24px; border-radius: 8px; color: white; font-weight: 500;
            box-shadow: 0 4px 20px rgba(0,0,0,0.2); opacity: 0; z-index: 10000;
            transition: all 0.3s ease;
        `;
        document.body.appendChild(toast);
    }
    
    const colors = { success: '#4CAF50', error: '#f44336', info: '#2196F3', warning: '#FF9800' };
    toast.textContent = message;
    toast.style.background = colors[type] || colors.info;
    toast.style.transform = 'translateX(-50%) translateY(0)';
    toast.style.opacity = '1';
    
    setTimeout(() => {
        toast.style.transform = 'translateX(-50%) translateY(100px)';
        toast.style.opacity = '0';
    }, duration);
}

// ============================================================================
// EXPORT ALL
// ============================================================================

export default {
    auth,
    db,
    storage,
    USER_ROLES,
    // Auth
    signUp,
    signIn,
    signOut,
    resetPassword,
    changeEmail,
    changePassword,
    getCurrentUser,
    onAuthChange,
    // Users
    createUserProfile,
    getUserProfile,
    updateUserProfile,
    updateLastLogin,
    uploadProfilePicture,
    // Patients (with assignment)
    addPatient,
    getMyPatients,
    getAssignedPatients,
    getInstitutePatients,
    getPatient,
    updatePatient,
    deletePatient,
    searchPatients,
    assignPatientToDoctor,
    linkPatientToUser,
    // Appointments
    createAppointment,
    getMyAppointments,
    getPatientAppointments,
    getUpcomingAppointments,
    updateAppointment,
    deleteAppointment,
    // Documents
    uploadDocument,
    getPatientDocuments,
    getMyDocuments,
    deleteDocument,
    // Medications
    recordMedicationAdministration,
    getMyMedicationRecords,
    updateMedicationInventory,
    getMedicationInventory,
    // Prescriptions
    addPrescription,
    getMyPrescriptions,
    getPatientPrescriptions,
    // Tasks & Reminders
    addTask,
    getMyTasks,
    updateTask,
    deleteTask,
    addReminder,
    getMyReminders,
    getTodaysReminders,
    // Emergency Contacts
    addEmergencyContact,
    getEmergencyContacts,
    updateEmergencyContact,
    deleteEmergencyContact,
    // Medical Info
    saveMedicalInfo,
    getMedicalInfo,
    // Reports
    generateReport,
    getMyReports,
    // Insurance & Billing
    verifyInsurance,
    createInvoice,
    processPayment,
    createClaim,
    // Patient-specific
    addAilmentTreatment,
    getMyAilmentsTreatments,
    addInstituteVisited,
    getMyInstitutesVisited,
    requestRefill,
    getMyRefillRequests,
    // Check-ins
    checkInPatient,
    getMyCheckIns,
    // Utils
    formatTimestamp,
    formatDate,
    formatTime,
    isValidEmail,
    isValidNamibianPhone,
    isValidNamibianId,
    initInactivityTimer,
    showToast
};