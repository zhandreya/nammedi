/**
 * Namibia Health Services - Supabase Backend Module
 * Same public API as the previous Firebase module.
 */

import { supabaseConfig } from './supabase-config.js';
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

export const supabase = createClient(supabaseConfig.url, supabaseConfig.anonKey, {
    // sessionStorage = each browser tab keeps its OWN login session,
    // so different users can be signed in on different tabs of the same window.
    auth: { storage: sessionStorage, persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
});

export const auth = {
    get currentUser() {
        return getCurrentUser();
    }
};
export const db = supabase;
export const storage = supabase.storage;

const T = {
    USERS: 'users',
    PATIENTS: 'patients',
    APPOINTMENTS: 'appointments',
    DOCUMENTS: 'documents',
    MEDICATION_RECORDS: 'medication_records',
    MEDICATION_INVENTORY: 'medication_inventory',
    TASKS: 'tasks',
    REMINDERS: 'reminders',
    EMERGENCY_CONTACTS: 'emergency_contacts',
    MEDICAL_INFO: 'medical_info',
    PRESCRIPTIONS: 'prescriptions',
    REPORTS: 'reports',
    INSURANCE_VERIFICATIONS: 'insurance_verifications',
    INVOICES: 'invoices',
    PAYMENTS: 'payments',
    CLAIMS: 'claims',
    REFILL_REQUESTS: 'refill_requests',
    AILMENTS_TREATMENTS: 'ailments_treatments',
    INSTITUTES_VISITED: 'institutes_visited',
    CHECK_INS: 'check_ins'
};

export const DEFAULT_AVATAR = 'default-profile.png';

export function resolveProfilePicture(profileOrUrl) {
    if (!profileOrUrl) return DEFAULT_AVATAR;
    if (typeof profileOrUrl === 'string') {
        return profileOrUrl.trim() ? profileOrUrl : DEFAULT_AVATAR;
    }
    const url = profileOrUrl.profilePictureUrl || profileOrUrl.avatar_url || profileOrUrl.avatarUrl || profileOrUrl.profile_picture_url || profileOrUrl.profilePicture || profileOrUrl.profile_picture || '';
    return url && String(url).trim() ? url : DEFAULT_AVATAR;
}

export function dashboardForRole(role) {
    switch (role) {
        case USER_ROLES.MEDICAL_STAFF:
            return 'medical-staff-dashboard.html';
        case USER_ROLES.RECEPTIONIST:
            return 'receptionist-dashboard.html';
        case USER_ROLES.SPECIALIST:
            return 'specialist-dashboard.html';
        case USER_ROLES.ADMIN:
            return 'medical-staff-dashboard.html';
        case USER_ROLES.PATIENT:
        default:
            return 'patient-dashboard.html';
    }
}

export async function redirectAfterAuth(user) {
    if (!user) {
        window.location.href = 'login.html';
        return;
    }
    try {
        const profile = await getUserProfile(user.uid || user.id);
        window.location.href = dashboardForRole(profile?.role || user.user_metadata?.role);
    } catch (e) {
        window.location.href = 'patient-dashboard.html';
    }
}

/** Keep the visitor on this page only if their role is allowed; otherwise send them to their dashboard. */
export async function requireRole(allowedRoles) {
    const { data } = await supabase.auth.getSession();
    const user = mapUser(data.session?.user || null);
    if (!user) {
        window.location.href = 'login.html';
        return null;
    }
    let profile = null;
    try {
        profile = await getUserProfile(user.uid);
    } catch (e) {
        console.warn(e);
    }
    const role = profile?.role || user.user_metadata?.role || USER_ROLES.PATIENT;
    const allowed = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
    if (allowed.length && !allowed.includes(role)) {
        window.location.href = dashboardForRole(role);
        return null;
    }
    return { user, profile, role };
}

export const USER_ROLES = {
    PATIENT: 'patient',
    MEDICAL_STAFF: 'medical_staff',
    RECEPTIONIST: 'receptionist',
    SPECIALIST: 'specialist',
    ADMIN: 'admin'
};

function mapUser(user) {
    if (!user) return null;
    return {
        uid: user.id,
        id: user.id,
        email: user.email,
        displayName: user.user_metadata?.fullName || user.user_metadata?.displayName || '',
        ...user
    };
}

function nowIso() {
    return new Date().toISOString();
}

function authError(error) {
    const msg = (error && (error.message || error.code)) || 'An error occurred. Please try again.';
    const map = {
        'User already registered': 'This email is already registered.',
        'Invalid login credentials': 'Invalid credentials provided.',
        'Email not confirmed': 'Please confirm your email before signing in.',
        'Password should be at least 6 characters.': 'Password should be at least 6 characters.'
    };
    return new Error(map[msg] || msg);
}

function requireUser() {
    const user = getCurrentUser();
    if (!user) throw new Error('Not authenticated');
    return user;
}

async function insertRow(table, row) {
    const { data, error } = await supabase.from(table).insert(row).select().single();
    if (error) throw error;
    return data;
}

async function updateRow(table, id, data) {
    const { error } = await supabase.from(table).update({ ...data, updated_at: nowIso() }).eq('id', id);
    if (error) throw error;
}

async function deleteRow(table, id) {
    const { error } = await supabase.from(table).delete().eq('id', id);
    if (error) throw error;
}

async function selectEq(table, column, value, orderBy = 'created_at', ascending = false) {
    let q = supabase.from(table).select('*').eq(column, value);
    if (orderBy) q = q.order(orderBy, { ascending });
    const { data, error } = await q;
    if (error) throw error;
    return data || [];
}

export async function signUp(email, password, profileData = {}) {
    try {
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: { data: { fullName: profileData.fullName || '', role: profileData.role || USER_ROLES.PATIENT } }
        });
        if (error) throw error;
        if (data.user) {
            await createUserProfile(data.user.id, {
                email,
                role: profileData.role || USER_ROLES.PATIENT,
                ...profileData,
                createdAt: nowIso()
            });
        }
        return { user: mapUser(data.user), session: data.session };
    } catch (error) {
        throw authError(error);
    }
}

export async function signIn(email, password) {
    try {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        if (data.user) await updateLastLogin(data.user.id);
        return { user: mapUser(data.user), session: data.session };
    } catch (error) {
        throw authError(error);
    }
}

export async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw new Error('Failed to sign out. Please try again.');
    window.__SUPABASE_CURRENT_USER__ = null;
}

export async function resetPassword(email) {
    const redirectTo = 'https://zhandreya.github.io/nammedi/forgot-password.html';
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    if (error) throw authError(error);
}

export async function changeEmail(newEmail, currentPassword) {
    const user = requireUser();
    const { error: signErr } = await supabase.auth.signInWithPassword({ email: user.email, password: currentPassword });
    if (signErr) throw authError(signErr);
    const { error } = await supabase.auth.updateUser({ email: newEmail });
    if (error) throw authError(error);
    await updateUserProfile(user.uid, { email: newEmail });
}

export async function changePassword(currentPassword, newPassword) {
    const user = requireUser();
    const { error: signErr } = await supabase.auth.signInWithPassword({ email: user.email, password: currentPassword });
    if (signErr) throw authError(signErr);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw authError(error);
}

export function getCurrentUser() {
    return window.__SUPABASE_CURRENT_USER__ || null;
}

export function onAuthChange(callback) {
    supabase.auth.getSession().then(({ data }) => {
        const mapped = mapUser(data.session?.user || null);
        window.__SUPABASE_CURRENT_USER__ = mapped;
        callback(mapped);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
        const mapped = mapUser(session?.user || null);
        window.__SUPABASE_CURRENT_USER__ = mapped;
        callback(mapped);
    });
    return () => sub.subscription.unsubscribe();
}

supabase.auth.getSession().then(({ data }) => {
    window.__SUPABASE_CURRENT_USER__ = mapUser(data.session?.user || null);
});

export async function createUserProfile(uid, data) {
    const profileData = {
        id: uid,
        email: data.email || '',
        role: data.role || USER_ROLES.PATIENT,
        full_name: data.fullName || '',
        surname: data.surname || '',
        dob: data.dob || null,
        gender: data.gender || null,
        id_passport: data.idPassport || null,
        phone: data.phone || data.cellPhone || data.workTel || null,
        work_tel: data.workTel || null,
        profession: data.profession || data.speciality || null,
        institute: data.institute || data.institution || null,
        place_of_birth: data.placeOfBirth || null,
        username: data.username || null,
        speciality: data.speciality || null,
        assigned_doctor: data.assignedDoctor || null,
        avatar_url: data.avatarUrl || data.profilePictureUrl || null,
        profile_picture: data.profilePicture || null,
        created_at: data.createdAt || nowIso(),
        updated_at: nowIso(),
        last_login_at: nowIso()
    };
    const { error } = await supabase.from(T.USERS).upsert(profileData);
    if (error) throw error;
    return profileData;
}

export async function getUserProfile(uid) {
    const { data, error } = await supabase.from(T.USERS).select('*').eq('id', uid).maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return camelUser(data);
}

function camelUser(d) {
    return {
        id: d.id,
        uid: d.uid || d.id,
        email: d.email,
        role: d.role,
        fullName: d.full_name,
        surname: d.surname,
        dob: d.dob,
        gender: d.gender,
        idPassport: d.id_passport,
        phone: d.phone,
        workTel: d.work_tel,
        profession: d.profession,
        institute: d.institute,
        placeOfBirth: d.place_of_birth,
        username: d.username,
        speciality: d.speciality,
        assignedDoctor: d.assigned_doctor,
        profilePictureUrl: d.avatar_url || d.profile_picture_url,
        avatarUrl: d.avatar_url,
        profilePicture: d.profile_picture,
        createdAt: d.created_at,
        updatedAt: d.updated_at,
        lastLoginAt: d.last_login_at,
        ...d
    };
}

export async function updateUserProfile(uid, data) {
    const mapped = {};
    const map = {
        fullName: 'full_name', surname: 'surname', dob: 'dob', gender: 'gender',
        idPassport: 'id_passport', phone: 'phone', workTel: 'work_tel',
        profession: 'profession', institute: 'institute', placeOfBirth: 'place_of_birth',
        username: 'username', speciality: 'speciality', assignedDoctor: 'assigned_doctor',
        profilePictureUrl: 'avatar_url', avatarUrl: 'avatar_url', profilePicture: 'profile_picture',
        email: 'email', role: 'role'
    };
    Object.keys(data).forEach(k => {
        mapped[map[k] || k] = data[k];
    });
    mapped.updated_at = nowIso();
    const { error } = await supabase.from(T.USERS).update(mapped).eq('id', uid);
    if (error) throw error;
}

export async function updateLastLogin(uid) {
    const { error } = await supabase.from(T.USERS).update({ last_login_at: nowIso() }).eq('id', uid);
    if (error) console.warn('updateLastLogin', error);
}

export async function uploadProfilePicture(uid, file) {
    const path = `${uid}/${Date.now()}_${file.name}`;
    const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true });
    if (error) throw error;
    const { data } = supabase.storage.from('avatars').getPublicUrl(path);
    const downloadUrl = data.publicUrl;
    await updateUserProfile(uid, { avatarUrl: downloadUrl, profilePictureUrl: downloadUrl });
    return downloadUrl;
}

export async function addPatient(uid, patientData) {
    // Accepts (uid, patientData) as used by all call sites; the signed-in user is authoritative.
    const user = requireUser();
    const row = {
        full_name: patientData.fullName || patientData.full_name,
        surname: patientData.surname,
        dob: patientData.dob || null,
        age: patientData.age ?? null,
        gender: patientData.gender || null,
        id_passport: patientData.idPassport || patientData.id_passport || null,
        phone: patientData.phone || patientData.cellphone || null,
        cellphone: patientData.cellphone || patientData.phone || null,
        insurance: patientData.insurance || null,
        institution: patientData.institution || patientData.institute || null,
        institute: patientData.institute || patientData.institution || null,
        reason: patientData.reason || null,
        notes: patientData.notes || null,
        created_by: user.uid,
        created_by_email: user.email,
        patient_user_id: patientData.patientUserId || null,
        assigned_doctor: patientData.assignedDoctor || user.uid,
        created_at: nowIso(),
        updated_at: nowIso()
    };
    const data = await insertRow(T.PATIENTS, row);
    return { id: data.id, ...patientData };
}

// PostgREST returns snake_case; UI code expects camelCase. Keep both.
function camelPatient(d) {
    if (!d) return d;
    return {
        ...d,
        fullName: d.full_name,
        idPassport: d.id_passport,
        patientUserId: d.patient_user_id,
        assignedDoctor: d.assigned_doctor,
        createdBy: d.created_by,
        createdAt: d.created_at,
        updatedAt: d.updated_at
    };
}

// Registered specialists (doctors) — used to suggest names when booking
export async function getSpecialists() {
    const { data, error } = await supabase.from(T.USERS)
        .select('*').eq('role', 'specialist')
        .order('full_name', { ascending: true });
    if (error) throw error;
    return (data || []).map(camelUser);
}

function normInst(v) {
    return String(v || '').trim().toLowerCase();
}

export async function getMyPatients() {
    const user = requireUser();
    let rows = await selectEq(T.PATIENTS, 'created_by', user.uid);
    // Institute sharing: staff also see patients registered at their own
    // institute (by any colleague there), matched case-insensitively.
    let profile = null;
    try { profile = await getUserProfile(user.uid); } catch (e) { /* ignore */ }
    if (profile && profile.role && profile.role !== 'patient' && profile.institute) {
        const inst = normInst(profile.institute);
        if (inst) {
            const { data: all } = await supabase.from(T.PATIENTS)
                .select('*').order('created_at', { ascending: false }).limit(1000);
            const seen = new Set(rows.map(r => r.id));
            (all || []).forEach(p => {
                if (!seen.has(p.id) && normInst(p.institute || p.institution) === inst) rows.push(p);
            });
        }
    }
    return rows.map(camelPatient);
}

export async function getAssignedPatients() {
    const user = requireUser();
    const rows = await selectEq(T.PATIENTS, 'assigned_doctor', user.uid);
    return rows.map(camelPatient);
}

export async function getInstitutePatients() {
    const user = requireUser();
    const userProfile = await getUserProfile(user.uid);
    if (!userProfile || !userProfile.institute) throw new Error('User has no institute assigned');
    const rows = await selectEq(T.PATIENTS, 'institute', userProfile.institute);
    return rows.map(camelPatient);
}

export async function getPatient(patientId) {
    const { data, error } = await supabase.from(T.PATIENTS).select('*').eq('id', patientId).maybeSingle();
    if (error) throw error;
    return camelPatient(data);
}

export async function updatePatient(patientId, data) {
    const row = {};
    const put = (k, v) => { if (v !== undefined) row[k] = v; };
    put('full_name', data.fullName !== undefined ? data.fullName : data.full_name);
    put('surname', data.surname);
    put('dob', data.dob);
    put('age', data.age);
    put('gender', data.gender);
    put('id_passport', data.idPassport !== undefined ? data.idPassport : data.id_passport);
    put('phone', data.phone !== undefined ? data.phone : data.cellphone);
    put('cellphone', data.cellphone !== undefined ? data.cellphone : data.phone);
    put('insurance', data.insurance);
    put('institution', data.institution !== undefined ? data.institution : data.institute);
    put('institute', data.institute !== undefined ? data.institute : data.institution);
    put('reason', data.reason);
    put('notes', data.notes);
    await updateRow(T.PATIENTS, patientId, row);
}

export async function assignPatientToDoctor(patientId, doctorId) {
    await updateRow(T.PATIENTS, patientId, { assigned_doctor: doctorId });
    const patient = await getPatient(patientId);
    if (patient && patient.patient_user_id) {
        await updateUserProfile(patient.patient_user_id, { assignedDoctor: doctorId });
    }
}

export async function linkPatientToUser(patientId, patientUserId) {
    await updateRow(T.PATIENTS, patientId, { patient_user_id: patientUserId });
    const patient = await getPatient(patientId);
    await updateUserProfile(patientUserId, { assignedDoctor: patient?.assigned_doctor });
}

export async function deletePatient(patientId) {
    await deleteRow(T.PATIENTS, patientId);
}

export async function searchPatients(searchTerm) {
    const patients = await getMyPatients();
    const term = searchTerm.toLowerCase();
    return patients.filter(p =>
        (p.fullName || p.full_name || '').toLowerCase().includes(term) ||
        (p.surname || '').toLowerCase().includes(term) ||
        String(p.idPassport || p.id_passport || '').includes(term) ||
        String(p.cellphone || p.phone || '').includes(term)
    );
}

export async function createAppointment(appointmentData, maybeData) {
    const user = requireUser();
    const src = (maybeData && typeof maybeData === 'object') ? maybeData : appointmentData;
    // Record who booked it as the doctor/specialist when not given explicitly
    let doctor = src.doctorSpecialist || src.doctor || null;
    if (!doctor) {
        try {
            const prof = await getUserProfile(user.uid);
            if (prof && prof.role === 'specialist') {
                doctor = [prof.surname, prof.fullName].filter(Boolean).map(s => String(s).trim()).join(' ') || null;
            }
        } catch (e) { /* leave blank -> shows TBA */ }
    }
    const data = await insertRow(T.APPOINTMENTS, {
        patient_id: src.patientId || src.patient_id || null,
        patient_user_id: src.patientUserId || null,
        patient_name: src.patientName || src.fullName || null,
        patient_surname: src.patientSurname || src.surname || null,
        patient_dob: src.patientDob || src.dob || null,
        patient_id_passport: src.patientIdPassport || null,
        doctor_specialist: doctor,
        institution: src.institution || null,
        date: src.date,
        time: src.time || null,
        reason: src.reason || null,
        notes: src.notes || null,
        created_by: user.uid,
        created_by_email: user.email,
        status: src.status || 'scheduled',
        created_at: nowIso(),
        updated_at: nowIso()
    });
    return { id: data.id, ...src };
}

export async function getMyAppointments() {
    const user = requireUser();
    // Appointments I created, or made for my account / registered details.
    let profile = null;
    try { profile = await getUserProfile(user.uid); } catch (e) { /* fall back to id-based match */ }
    const conds = [`created_by.eq.${user.uid}`, `patient_user_id.eq.${user.uid}`];
    if (profile && profile.idPassport) conds.push(`patient_id_passport.eq.${profile.idPassport.trim()}`);
    const { data, error } = await supabase.from(T.APPOINTMENTS)
        .select('*').or(conds.join(','))
        .order('date', { ascending: true }).order('time', { ascending: true });
    if (error) throw error;
    let list = data || [];
    // ...or recorded with my name + surname + date of birth
    if (profile && profile.fullName && profile.surname) {
        let q = supabase.from(T.APPOINTMENTS).select('*')
            .filter('patient_name', 'ilike', profile.fullName.trim())
            .filter('patient_surname', 'ilike', profile.surname.trim());
        if (profile.dob) q = q.eq('patient_dob', profile.dob);
        const { data: byName, error: nameError } = await q.order('date', { ascending: true });
        if (!nameError && byName) list = list.concat(byName);
    }
    const seen = new Set();
    return list.filter(a => { if (seen.has(a.id)) return false; seen.add(a.id); return true; });
}

export async function getPatientAppointments(patientId) {
    const { data, error } = await supabase.from(T.APPOINTMENTS)
        .select('*').eq('patient_id', patientId).order('date', { ascending: true });
    if (error) throw error;
    return data || [];
}

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

export async function updateAppointment(appointmentId, data) {
    const row = {};
    const put = (k, v) => { if (v !== undefined) row[k] = v; };
    put('patient_id', data.patientId !== undefined ? data.patientId : data.patient_id);
    put('patient_user_id', data.patientUserId !== undefined ? data.patientUserId : data.patient_user_id);
    put('patient_name', data.patientName !== undefined ? data.patientName : data.patient_name);
    put('patient_surname', data.patientSurname !== undefined ? data.patientSurname : data.patient_surname);
    put('patient_dob', data.patientDob !== undefined ? data.patientDob : data.patient_dob);
    put('patient_id_passport', data.patientIdPassport !== undefined ? data.patientIdPassport : data.patient_id_passport);
    put('doctor_specialist', data.doctorSpecialist !== undefined ? data.doctorSpecialist : data.doctor_specialist);
    put('institution', data.institution);
    put('date', data.date);
    put('time', data.time);
    put('reason', data.reason);
    put('notes', data.notes);
    put('status', data.status);
    await updateRow(T.APPOINTMENTS, appointmentId, row);
}

export async function deleteAppointment(appointmentId) {
    await deleteRow(T.APPOINTMENTS, appointmentId);
}

export async function uploadDocument(patientId, file, category = 'general') {
    const user = requireUser();
    const path = `documents/${patientId}/${Date.now()}_${file.name}`;
    const { error } = await supabase.storage.from('documents').upload(path, file, { upsert: true });
    if (error) throw error;
    const { data: pub } = supabase.storage.from('documents').getPublicUrl(path);
    const fileUrl = pub.publicUrl;
    const patient = await getPatient(patientId);
    const rec = await insertRow(T.DOCUMENTS, {
        patient_id: patientId,
        patient_user_id: patient?.patient_user_id || patient?.patientUserId || '',
        file_name: file.name,
        file_url: fileUrl,
        file_size: file.size,
        file_type: file.type,
        category,
        uploaded_by: user.uid,
        uploaded_by_email: user.email,
        upload_date: new Date().toISOString().split('T')[0],
        created_at: nowIso()
    });
    return { id: rec.id, fileName: file.name, fileUrl, category };
}

export async function getPatientDocuments(patientId) {
    return selectEq(T.DOCUMENTS, 'patient_id', patientId);
}

export async function getMyDocuments() {
    const user = requireUser();
    return selectEq(T.DOCUMENTS, 'uploaded_by', user.uid);
}

export async function deleteDocument(documentId) {
    const { data } = await supabase.from(T.DOCUMENTS).select('*').eq('id', documentId).maybeSingle();
    if (data) {
        try {
            if (data.file_url) {
                const marker = '/documents/';
                const idx = data.file_url.indexOf(marker);
                if (idx !== -1) {
                    const path = data.file_url.slice(idx + marker.length);
                    await supabase.storage.from('documents').remove([path]);
                }
            }
        } catch (e) {
            console.warn('Could not delete from storage:', e);
        }
        await deleteRow(T.DOCUMENTS, documentId);
    }
}

export async function recordMedicationAdministration(medData) {
    const user = requireUser();
    const rec = await insertRow(T.MEDICATION_RECORDS, {
        ...medData,
        administered_by: user.uid,
        administered_by_email: user.email,
        created_at: nowIso()
    });
    return { id: rec.id, ...medData };
}

export async function getMyMedicationRecords() {
    const user = requireUser();
    return selectEq(T.MEDICATION_RECORDS, 'administered_by', user.uid);
}

export async function updateMedicationInventory(inventoryData) {
    const user = requireUser();
    const { error } = await supabase.from(T.MEDICATION_INVENTORY).upsert({
        id: user.uid,
        ...inventoryData,
        updated_by: user.uid,
        updated_at: nowIso()
    });
    if (error) throw error;
}

export async function getMedicationInventory() {
    const user = requireUser();
    const { data, error } = await supabase.from(T.MEDICATION_INVENTORY).select('*').eq('id', user.uid).maybeSingle();
    if (error) throw error;
    return data;
}

export async function addPrescription(prescriptionData) {
    const user = requireUser();
    const rec = await insertRow(T.PRESCRIPTIONS, {
        ...prescriptionData,
        prescribed_by: user.uid,
        prescribed_by_email: user.email,
        patient_user_id: prescriptionData.patientUserId || '',
        created_at: nowIso()
    });
    return { id: rec.id, ...prescriptionData };
}

export async function getMyPrescriptions() {
    const user = requireUser();
    return selectEq(T.PRESCRIPTIONS, 'prescribed_by', user.uid);
}

export async function getPatientPrescriptions(patientUserId) {
    return selectEq(T.PRESCRIPTIONS, 'patient_user_id', patientUserId);
}

export async function addTask(taskData) {
    const user = requireUser();
    const rec = await insertRow(T.TASKS, {
        ...taskData,
        user_id: user.uid,
        completed: false,
        created_at: nowIso()
    });
    return { id: rec.id, ...taskData };
}

export async function getMyTasks() {
    const user = requireUser();
    return selectEq(T.TASKS, 'user_id', user.uid);
}

export async function updateTask(taskId, data) {
    const { error } = await supabase.from(T.TASKS).update(data).eq('id', taskId);
    if (error) throw error;
}

export async function deleteTask(taskId) {
    await deleteRow(T.TASKS, taskId);
}

export async function addReminder(reminderData) {
    const user = requireUser();
    const rec = await insertRow(T.REMINDERS, {
        ...reminderData,
        user_id: user.uid,
        created_at: nowIso()
    });
    return { id: rec.id, ...reminderData };
}

export async function getMyReminders() {
    const user = requireUser();
    const { data, error } = await supabase.from(T.REMINDERS)
        .select('*').eq('user_id', user.uid)
        .order('date', { ascending: true }).order('time', { ascending: true });
    if (error) throw error;
    return data || [];
}

export async function getTodaysReminders() {
    const reminders = await getMyReminders();
    const today = new Date().toISOString().split('T')[0];
    return reminders.filter(r => r.date === today);
}

export async function addEmergencyContact(contactData) {
    const user = requireUser();
    const rec = await insertRow(T.EMERGENCY_CONTACTS, {
        ...contactData,
        user_id: user.uid,
        created_at: nowIso()
    });
    return { id: rec.id, ...contactData };
}

export async function getEmergencyContacts() {
    const user = requireUser();
    return selectEq(T.EMERGENCY_CONTACTS, 'user_id', user.uid, null);
}

export async function updateEmergencyContact(contactId, data) {
    const { error } = await supabase.from(T.EMERGENCY_CONTACTS).update(data).eq('id', contactId);
    if (error) throw error;
}

export async function deleteEmergencyContact(contactId) {
    await deleteRow(T.EMERGENCY_CONTACTS, contactId);
}

export async function saveMedicalInfo(medicalData) {
    const user = requireUser();
    const { error } = await supabase.from(T.MEDICAL_INFO).upsert({
        id: user.uid,
        user_id: user.uid,
        ...medicalData,
        updated_at: nowIso()
    });
    if (error) throw error;
}

export async function getMedicalInfo() {
    const user = requireUser();
    const { data, error } = await supabase.from(T.MEDICAL_INFO).select('*').eq('user_id', user.uid).maybeSingle();
    if (error) throw error;
    return data;
}

export async function generateReport(reportData) {
    const user = requireUser();
    const rec = await insertRow(T.REPORTS, {
        ...reportData,
        generated_by: user.uid,
        generated_by_email: user.email,
        created_at: nowIso()
    });
    return { id: rec.id, ...reportData };
}

export async function getMyReports() {
    const user = requireUser();
    return selectEq(T.REPORTS, 'generated_by', user.uid);
}

export async function verifyInsurance(insuranceData) {
    const user = requireUser();
    const rec = await insertRow(T.INSURANCE_VERIFICATIONS, {
        ...insuranceData,
        verified_by: user.uid,
        verified_by_email: user.email,
        created_at: nowIso()
    });
    return { id: rec.id, ...insuranceData };
}

export async function createInvoice(invoiceData) {
    const user = requireUser();
    let patient = null;
    if (invoiceData.patientId) {
        try { patient = await getPatient(invoiceData.patientId); } catch (e) { /* patient lookup is best-effort */ }
    }
    const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const invoiceNumber = invoiceData.invoiceNumber || `INV-${stamp}-${String(Math.floor(Math.random() * 9000) + 1000)}`;
    const paid = invoiceData.paid === true || invoiceData.paid === 'true';
    const rec = await insertRow(T.INVOICES, {
        patient_id: invoiceData.patientId || null,
        patient_name: patient ? (patient.fullName || null) : (invoiceData.patientName || null),
        patient_surname: patient ? (patient.surname || null) : (invoiceData.patientSurname || null),
        invoice_number: invoiceNumber,
        date: invoiceData.date,
        reason: invoiceData.reason || null,
        prescription: invoiceData.prescription || null,
        treatment: invoiceData.treatment || null,
        fee: invoiceData.fee ?? 0,
        paid: paid,
        status: invoiceData.status || (paid ? 'paid' : 'pending'),
        created_by: user.uid,
        created_by_email: user.email,
        created_at: nowIso()
    });
    return { ...rec, patientName: rec.patient_name, patientSurname: rec.patient_surname, invoiceNumber: rec.invoice_number, pdfUrl: rec.pdf_url };
}

export async function processPayment(paymentData) {
    const user = requireUser();
    let patient = null;
    if (paymentData.patientId) {
        try { patient = await getPatient(paymentData.patientId); } catch (e) { /* best-effort */ }
    }
    const rec = await insertRow(T.PAYMENTS, {
        patient_id: paymentData.patientId || null,
        patient_name: patient ? (patient.fullName || null) : null,
        patient_surname: patient ? (patient.surname || null) : null,
        id_passport: patient ? (patient.idPassport || null) : null,
        cell_phone: patient ? (patient.cellphone || patient.phone || null) : null,
        date: paymentData.date,
        amount: paymentData.amount ?? 0,
        method: paymentData.method || null,
        reference: paymentData.reference || null,
        processed_by: user.uid,
        processed_by_email: user.email,
        created_at: nowIso()
    });
    return { id: rec.id, ...paymentData };
}


// ============ BILLING READERS (scoped by RLS: own + shared institute) ============
export async function getInvoices() {
    const { data, error } = await supabase.from(T.INVOICES)
        .select('*').order('date', { ascending: false }).order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []).map(i => ({
        id: i.id, patientId: i.patient_id, patientName: i.patient_name, patientSurname: i.patient_surname,
        invoiceNumber: i.invoice_number, date: i.date, reason: i.reason, prescription: i.prescription,
        treatment: i.treatment, fee: i.fee, paid: i.paid, status: i.status,
        pdfUrl: i.pdf_url, createdBy: i.created_by, createdAt: i.created_at
    }));
}

export async function getPayments() {
    const { data, error } = await supabase.from(T.PAYMENTS)
        .select('*').order('date', { ascending: false }).order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []).map(p => ({
        id: p.id, patientId: p.patient_id, patientName: p.patient_name, patientSurname: p.patient_surname,
        idPassport: p.id_passport, cellPhone: p.cell_phone, date: p.date, amount: p.amount,
        method: p.method, reference: p.reference, processedBy: p.processed_by, createdAt: p.created_at
    }));
}

export async function markInvoicePaid(invoiceId) {
    await updateRow(T.INVOICES, invoiceId, { paid: true, status: 'paid' });
}

// ============ INVOICE PDF (jsPDF, loaded via <script> on the pages) ============
export function buildInvoicePdf(invoice) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const name = `${invoice.patientName || ''} ${invoice.patientSurname || ''}`.trim() || 'Patient';
    doc.setFillColor(0, 102, 204);
    doc.rect(0, 0, 210, 28, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18); doc.setFont('helvetica', 'bold');
    doc.text('TAX INVOICE', 14, 12);
    doc.setFontSize(10); doc.setFont('helvetica', 'normal');
    doc.text('Namibia Health Services', 14, 20);
    doc.setTextColor(30, 30, 30);
    doc.setFontSize(12); doc.setFont('helvetica', 'bold');
    doc.text(`Invoice No: ${invoice.invoiceNumber || '-'}`, 14, 42);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(11);
    doc.text(`Date: ${invoice.date ? String(invoice.date).slice(0, 10) : '-'}`, 14, 50);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(invoice.paid ? 27 : 198, invoice.paid ? 94 : 40, invoice.paid ? 60 : 40);
    doc.text(`Status: ${invoice.paid ? 'PAID' : 'UNPAID'}`, 196, 42, { align: 'right' });
    doc.setTextColor(30, 30, 30);
    doc.setFont('helvetica', 'normal');
    doc.line(14, 58, 196, 58);
    doc.setFont('helvetica', 'bold');
    doc.text('Billed to:', 14, 68);
    doc.setFont('helvetica', 'normal');
    doc.text(name, 14, 76);
    let y = 84;
    if (invoice.idPassport) { doc.text(`ID/Passport: ${invoice.idPassport}`, 14, y); y += 8; }
    if (invoice.cellPhone) { doc.text(`Phone: ${invoice.cellPhone}`, 14, y); y += 8; }
    y += 10;
    doc.line(14, y - 8, 196, y - 8);
    doc.setFont('helvetica', 'bold');
    doc.text('Description', 16, y);
    doc.text('Amount (NAD)', 194, y, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    y += 10;
    const lines = [];
    if (invoice.reason) lines.push(`Reason for visit: ${invoice.reason}`);
    if (invoice.treatment) lines.push(`Treatment: ${invoice.treatment}`);
    if (invoice.prescription) lines.push(`Prescription: ${invoice.prescription}`);
    if (!lines.length) lines.push('Medical services');
    lines.forEach((l, i) => {
        doc.text(String(l).slice(0, 95), 16, y + i * 8);
        if (i === lines.length - 1) doc.text(Number(invoice.fee || 0).toFixed(2), 194, y + i * 8, { align: 'right' });
    });
    y += lines.length * 8 + 6;
    doc.line(14, y - 6, 196, y - 6);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(13);
    doc.text('Total', 150, y + 2);
    doc.text(`NAD ${Number(invoice.fee || 0).toFixed(2)}`, 194, y + 2, { align: 'right' });
    doc.setFontSize(10); doc.setFont('helvetica', 'normal');
    doc.text(invoice.paid ? 'Payment received. Thank you.' : 'Balance due. Please settle at the front desk.', 14, y + 14);
    doc.text('Generated by Namibia Health Services - this is a computer-generated invoice.', 14, 287);
    return doc;
}

export async function generateInvoicePdf(invoice) {
    if (!window.jspdf) throw new Error('PDF library not loaded');
    return buildInvoicePdf(invoice).output('blob');
}

// Store the PDF where the patient can download it later (documents area)
export async function saveInvoicePdf(invoice, blob) {
    const user = requireUser();
    const fileName = `Invoice-${invoice.invoiceNumber || invoice.id}.pdf`;
    const folder = invoice.patientId || 'general';
    const path = `documents/${folder}/invoices/${Date.now()}_${fileName}`;
    const file = new File([blob], fileName, { type: 'application/pdf' });
    const { error } = await supabase.storage.from('documents').upload(path, file, { upsert: true });
    if (error) throw error;
    const { data: pub } = supabase.storage.from('documents').getPublicUrl(path);
    const fileUrl = pub.publicUrl;
    let patient = null;
    if (invoice.patientId) {
        try { patient = await getPatient(invoice.patientId); } catch (e) { /* best-effort */ }
    }
    await insertRow(T.DOCUMENTS, {
        patient_id: invoice.patientId || null,
        patient_user_id: patient ? (patient.patient_user_id || patient.patientUserId || '') : '',
        file_name: fileName,
        file_url: fileUrl,
        file_size: blob.size,
        file_type: 'application/pdf',
        category: 'invoice',
        uploaded_by: user.uid,
        uploaded_by_email: user.email,
        upload_date: new Date().toISOString().split('T')[0],
        created_at: nowIso()
    });
    try { await updateRow(T.INVOICES, invoice.id, { pdf_url: fileUrl }); } catch (e) { /* pdf_url is optional */ }
    return fileUrl;
}

// A patient's own documents (invoices, reports, ...) - RLS scopes the result
export async function getMyPatientDocuments() {
    const { data, error } = await supabase.from(T.DOCUMENTS)
        .select('*').order('upload_date', { ascending: false }).order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []).map(d => ({
        id: d.id, patientId: d.patient_id, fileName: d.file_name, fileUrl: d.file_url,
        fileSize: d.file_size, fileType: d.file_type, category: d.category, uploadDate: d.upload_date,
        createdAt: d.created_at
    }));
}

export async function createClaim(claimData) {
    const user = requireUser();
    const rec = await insertRow(T.CLAIMS, {
        ...claimData,
        created_by: user.uid,
        created_by_email: user.email,
        status: claimData.status || 'submitted',
        created_at: nowIso()
    });
    return { id: rec.id, ...claimData };
}

export async function addAilmentTreatment(ailmentData) {
    const user = requireUser();
    const rec = await insertRow(T.AILMENTS_TREATMENTS, {
        ...ailmentData,
        patient_id: user.uid,
        recorded_by: user.uid,
        created_at: nowIso()
    });
    return { id: rec.id, ...ailmentData };
}

export async function getMyAilmentsTreatments() {
    const user = requireUser();
    return selectEq(T.AILMENTS_TREATMENTS, 'patient_id', user.uid);
}

export async function addInstituteVisited(instituteData) {
    const user = requireUser();
    const rec = await insertRow(T.INSTITUTES_VISITED, {
        ...instituteData,
        patient_id: user.uid,
        created_at: nowIso()
    });
    return { id: rec.id, ...instituteData };
}

export async function getMyInstitutesVisited() {
    const user = requireUser();
    return selectEq(T.INSTITUTES_VISITED, 'patient_id', user.uid);
}

export async function requestRefill(refillData) {
    const user = requireUser();
    const rec = await insertRow(T.REFILL_REQUESTS, {
        ...refillData,
        patient_id: user.uid,
        patient_email: user.email,
        status: 'pending',
        created_at: nowIso()
    });
    return { id: rec.id, ...refillData };
}

export async function getMyRefillRequests() {
    const user = requireUser();
    return selectEq(T.REFILL_REQUESTS, 'patient_id', user.uid);
}

export async function checkInPatient(checkInData) {
    const user = requireUser();
    const rec = await insertRow(T.CHECK_INS, {
        ...checkInData,
        checked_in_by: user.uid,
        checked_in_by_email: user.email,
        created_at: nowIso()
    });
    return { id: rec.id, ...checkInData };
}

export async function getMyCheckIns() {
    const user = requireUser();
    return selectEq(T.CHECK_INS, 'checked_in_by', user.uid);
}

export function formatTimestamp(timestamp) {
    if (!timestamp) return 'Never';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleString('en-NA', {
        year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
}

export function formatDate(dateString) {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('en-NA');
}

export function formatTime(timeString) {
    return timeString || '';
}

export function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function isValidNamibianPhone(phone) {
    const cleaned = phone.replace(/[\s\-\(\)]/g, '');
    // National: mobiles are 0 + 9 digits, landlines are 0 + 8 digits
    if (/^0\d{8,9}$/.test(cleaned)) return true;
    // With country code: +264 / 264 / 00264 + 8-9 digits
    return /^(?:\+?0{0,2}264)\d{8,9}$/.test(cleaned);
}

export function isValidNamibianId(id) {
    return /^\d{11}$/.test(id.replace(/\s/g, ''));
}

let inactivityTimeout = null;
const DEFAULT_INACTIVITY_MS = 60 * 60 * 1000;

export function initInactivityTimer(timeoutMs = DEFAULT_INACTIVITY_MS, onTimeout = () => signOut()) {
    const events = ['load', 'mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
    function resetTimer() {
        clearTimeout(inactivityTimeout);
        inactivityTimeout = setTimeout(onTimeout, timeoutMs);
    }
    events.forEach(event => window.addEventListener(event, resetTimer, { passive: true }));
    resetTimer();
    return () => {
        clearTimeout(inactivityTimeout);
        events.forEach(event => window.removeEventListener(event, resetTimer));
    };
}

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

export const createPatient = addPatient;
export const getPatientsByStaff = getMyPatients;
// Staff appointment view: everything the database permissions allow —
// own appointments, plus shared-institute appointments once the
// institute policies are in place.
export async function getAppointmentsByStaff() {
    const { data, error } = await supabase.from(T.APPOINTMENTS)
        .select('*')
        .order('date', { ascending: true })
        .order('time', { ascending: true });
    if (error) throw error;
    return data || [];
}
export const getPatientById = getPatient;
export const getDocumentsByStaff = getMyDocuments;

export default {
    supabase, auth, db, storage, USER_ROLES,
    signUp, signIn, signOut, resetPassword, changeEmail, changePassword, getCurrentUser, onAuthChange,
    createUserProfile, getUserProfile, updateUserProfile, updateLastLogin, uploadProfilePicture,
    addPatient, createPatient, getMyPatients, getSpecialists, getPatientsByStaff, getAssignedPatients, getInstitutePatients,
    getPatient, getPatientById, updatePatient, getAppointmentsByStaff, getDocumentsByStaff,
    deletePatient, searchPatients, assignPatientToDoctor, linkPatientToUser,
    getInvoices, getPayments, markInvoicePaid, generateInvoicePdf, buildInvoicePdf, saveInvoicePdf, getMyPatientDocuments,
    createAppointment, getMyAppointments, getPatientAppointments, getUpcomingAppointments,
    updateAppointment, deleteAppointment,
    uploadDocument, getPatientDocuments, getMyDocuments, deleteDocument,
    recordMedicationAdministration, getMyMedicationRecords, updateMedicationInventory, getMedicationInventory,
    addPrescription, getMyPrescriptions, getPatientPrescriptions,
    addTask, getMyTasks, updateTask, deleteTask, addReminder, getMyReminders, getTodaysReminders,
    addEmergencyContact, getEmergencyContacts, updateEmergencyContact, deleteEmergencyContact,
    saveMedicalInfo, getMedicalInfo, generateReport, getMyReports,
    verifyInsurance, createInvoice, processPayment, createClaim,
    addAilmentTreatment, getMyAilmentsTreatments, addInstituteVisited, getMyInstitutesVisited,
    requestRefill, getMyRefillRequests, checkInPatient, getMyCheckIns,
    formatTimestamp, formatDate, formatTime, isValidEmail, isValidNamibianPhone, isValidNamibianId,
    initInactivityTimer, showToast, DEFAULT_AVATAR, resolveProfilePicture,
    dashboardForRole, redirectAfterAuth, requireRole
};
