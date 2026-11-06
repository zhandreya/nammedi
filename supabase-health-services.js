/**
 * Namibia Health Services - Supabase Backend Module
 * Same public API as the previous Firebase module.
 */

import { supabaseConfig } from './supabase-config.js';
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

// Each role's dashboard keeps its OWN login session in a dedicated
// per-tab "slot" (keyed by page name + a per-tab id). Sessions live in
// sessionStorage, so every browser tab is fully independent: logging in
// as a second user with the same role in another tab never affects the
// first tab (and vice versa).
// A per-TAB identity. Each browser tab keeps its OWN login session:
// logging in as a second doctor in a new tab never touches the first tab.
function tabId() {
    try {
        let t = sessionStorage.getItem('nm-tab-id');
        if (!t) {
            t = Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
            sessionStorage.setItem('nm-tab-id', t);
        }
        return t;
    } catch (e) { return 'anon'; }
}

function slotFromPath() {
    const page = (location.pathname.split('/').pop() || '').toLowerCase();
    if (page.indexOf('patient') === 0) return 'patient';
    // Only patients use the refill page - keep it on the patient slot so a
    // staff sign-in in another tab can never hijack its session.
    if (page === 'request-refill.html') return 'patient';
    if (page === 'receptionist-dashboard.html') return 'receptionist';
    if (page === 'medical-staff-dashboard.html') return 'medicalstaff';
    if (page === 'specialist-dashboard.html') return 'specialist';
    return 'default';
}

function projectRef() {
    try { return supabaseConfig.url.replace(/^https?:\/\//, '').split('.')[0]; } catch (e) { return 'unknown'; }
}

function slotStorage(slot) {
    const prefix = 'nm-auth-' + slot + '-';
    // Sessions live in sessionStorage (per tab) and each tab uses its own
    // storageKey, so the auth library's cross-tab BroadcastChannel never
    // carries one user's session into another tab. Two users with the same
    // role stay logged in side by side, each in their own tab.
    const newKey = 'nm-slot-' + slot + '-' + tabId();
    try {
        const oldKey = 'sb-' + projectRef() + '-auth-token';
        if (!sessionStorage.getItem(prefix + newKey) && sessionStorage.getItem(prefix + oldKey)) {
            sessionStorage.setItem(prefix + newKey, sessionStorage.getItem(prefix + oldKey));
            sessionStorage.removeItem(prefix + oldKey);
        }
    } catch (e) { /* ignore */ }
    return {
        getItem: (key) => { try { return sessionStorage.getItem(prefix + key); } catch (e) { return null; } },
        setItem: (key, value) => { try { sessionStorage.setItem(prefix + key, value); } catch (e) { /* ignore */ } },
        removeItem: (key) => { try { sessionStorage.removeItem(prefix + key); } catch (e) { /* ignore */ } }
    };
}

export const CURRENT_SLOT = slotFromPath();

export const supabase = createClient(supabaseConfig.url, supabaseConfig.anonKey, {
    auth: {
        storage: slotStorage(CURRENT_SLOT),
        storageKey: 'nm-slot-' + CURRENT_SLOT + '-' + tabId(),
        persistSession: true, autoRefreshToken: true, detectSessionInUrl: true
    }
});

// Fetch with retry: production can be slow; if the first call errors or
// returns an empty list, retry a few times before giving up. Used by the
// patient pages so a slow backend never shows a falsely-empty dashboard.
export async function fetchWithRetry(fetchFn, { attempts = 6, delayMs = 2000 } = {}) {
    let last = null;
    for (let i = 0; i < attempts; i++) {
        try {
            const res = await fetchFn();
            last = res;
            const empty = Array.isArray(res) ? res.length === 0 : !res;
            if (!empty) return res;
        } catch (e) {
            last = e;
        }
        if (i < attempts - 1) await new Promise(r => setTimeout(r, delayMs));
    }
    // All attempts exhausted: return the last value (an array, or [] on error).
    return Array.isArray(last) ? last : (last && last.data ? last.data : []);
}

const ROLE_SLOTS = {
    patient: 'patient',
    medical_staff: 'medicalstaff',
    receptionist: 'receptionist',
    specialist: 'specialist'
};

// After logging in / signing up (login.html / sign-up.html use the 'default'
// slot), copy the fresh session into the user's role slot so the role's
// dashboard picks it up and it survives tab reloads and browser tab discards.
export async function persistSessionForRole(role) {
    const slot = ROLE_SLOTS[role];
    if (!slot || slot === CURRENT_SLOT) return;
    try {
        const { data } = await supabase.auth.getSession();
        const session = data && data.session;
        if (!session) return;
        const tmp = createClient(supabaseConfig.url, supabaseConfig.anonKey, {
            auth: { storage: slotStorage(slot), storageKey: 'nm-slot-' + slot + '-' + tabId(), persistSession: true, autoRefreshToken: false, detectSessionInUrl: false }
        });
        await tmp.auth.setSession({ access_token: session.access_token, refresh_token: session.refresh_token });
    } catch (e) {
        console.warn('Could not persist session for role slot.', e);
    }
}

// True if the role's slot currently holds a stored session.
// (Role slots are set on login and cleared on sign-out, so a missing slot
// means that role is signed out - even if another slot still holds an old token.)
export function roleHasLiveSession(role) {
    const slot = ROLE_SLOTS[role];
    if (!slot) return false;
    try {
        const prefix = 'nm-auth-' + slot + '-';
        for (let i = 0; i < sessionStorage.length; i++) {
            const k = sessionStorage.key(i);
            if (k && k.indexOf(prefix) === 0) return true;
        }
    } catch (e) { /* ignore */ }
    return false;
}

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


// A patient can be registered at more than one institute (one row per
// institute). Their FULL medical history carries over across institutes,
// so history lookups match rows by patient_id OR by the patient's
// ID/Passport number.
async function patientPassportFor(patientId) {
    if (!patientId) return null;
    const id = String(patientId).trim();
    const looksUuid = id.length > 30;
    try {
        const p = await getPatient(id);
        if (p && (p.idPassport || p.id_passport)) return p.idPassport || p.id_passport;
    } catch (e) { /* not found by UUID - may be a passport */ }
    if (!looksUuid) {
        // A passport/ID number was given directly. Confirm it belongs to a
        // patient this account can see, then use it as the history key.
        try {
            const { data } = await supabase.from(T.PATIENTS).select('id_passport').eq('id_passport', id).maybeSingle();
            if (data && data.id_passport) return data.id_passport;
        } catch (e) { /* ignore */ }
    }
    return null;
}
async function collectPatientHistoryRows(table, passportCol, patientId) {
    if (!patientId) return [];
    let base = [];
    try { base = await selectEq(table, 'patient_id', patientId, null); } catch (e) { base = []; }
    const pass = await patientPassportFor(patientId);
    if (!pass || !passportCol) return base || [];
    let extra = [];
    try {
        const { data } = await supabase.from(table).select('*').eq(passportCol, pass);
        extra = data || [];
    } catch (e) { extra = []; }
    const seen = new Set((base || []).map(r => r.id));
    return [...(base || []), ...extra.filter(r => !seen.has(r.id))];
}

// Rows created before institute auto-fill (or with no institute) are shown
// with the patient's registered institute - details entered at registration
// are carried into every table at all times.
async function backfillPatientDetails(rows, opts = {}) {
    if (!rows || !rows.length) return rows;
    const needs = [];
    rows.forEach(r => {
        const missingInst = !r.institute && !r.institution;
        const missingDetails = opts.details && (!r.patient_name || !r.patient_surname || !r.patient_dob);
        if (r.patient_id && (missingInst || missingDetails)) needs.push(r.patient_id);
    });
    if (!needs.length) return rows;
    const ids = [...new Set(needs)];
    let plist = [];
    try {
        const { data } = await supabase.from(T.PATIENTS)
            .select('id, institute, institution, full_name, surname, dob, phone, cellphone')
            .in('id', ids).limit(500);
        plist = data || [];
    } catch (e) { return rows; }
    const pmap = new Map(plist.map(p => [p.id, p]));
    rows.forEach(r => {
        const p = pmap.get(r.patient_id);
        if (!p) return;
        const inst = p.institute || p.institution;
        if (inst) {
            if (!r.institute) r.institute = inst;
            if (!r.institution) r.institution = inst;
        }
        if (opts.details) {
            if (!r.patient_name && p.full_name) r.patient_name = p.full_name;
            if (!r.patient_surname && p.surname) r.patient_surname = p.surname;
            if (!r.patient_dob && p.dob) r.patient_dob = p.dob;
            if (opts.phone && !r.patient_phone && (p.cellphone || p.phone)) r.patient_phone = p.cellphone || p.phone;
        }
    });
    return rows;
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
    // Remember who is signing out (so the shared 'default' slot is only
    // cleared when it holds this user - never someone else's login).
    let uid = null;
    try {
        const { data } = await supabase.auth.getSession();
        uid = data && data.session ? data.session.user.id : null;
    } catch (e) { /* ignore */ }

    const { error } = await supabase.auth.signOut();

    if (CURRENT_SLOT !== 'default') {
        try {
            const prefix = 'nm-auth-default-';
            const remove = [];
            for (let i = 0; i < sessionStorage.length; i++) {
                const k = sessionStorage.key(i);
                if (!k || k.indexOf(prefix) !== 0) continue;
                try {
                    const parsed = JSON.parse(sessionStorage.getItem(k) || '');
                    if (parsed && parsed.user && parsed.user.id === uid) remove.push(k);
                } catch (e2) { /* not session JSON - leave it */ }
            }
            remove.forEach(k => sessionStorage.removeItem(k));
        } catch (e) { /* best effort */ }
    }

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

// Bumped on every code deploy. When the deployed code changes, every open
// session (old code) signs out and the user signs in again on the new code -
// so all users are always on the current version, all at the same time.
export const APP_VERSION = 'r33-20261106';
const VERSION_KEY = 'nm-app-version';

function checkAppVersion(session) {
    // Returns true if a forced sign-out was performed.
    try {
        const stored = sessionStorage.getItem(VERSION_KEY);
        if (session) {
            if (stored && stored !== APP_VERSION) {
                // System was updated while this tab was open - sign out.
                try { sessionStorage.setItem(VERSION_KEY, APP_VERSION); } catch (e) { /* ignore */ }
                supabase.auth.signOut().catch(() => {});
                if (!location.pathname.endsWith('login.html')) location.href = 'login.html';
                return true;
            }
            if (!stored) { try { sessionStorage.setItem(VERSION_KEY, APP_VERSION); } catch (e) { /* ignore */ } }
        } else {
            if (!stored) { try { sessionStorage.setItem(VERSION_KEY, APP_VERSION); } catch (e) { /* ignore */ } }
        }
    } catch (e) { /* version check is best-effort */ }
    return false;
}

export function onAuthChange(callback) {
    supabase.auth.getSession().then(({ data }) => {
        if (checkAppVersion(data.session)) return;
        const mapped = mapUser(data.session?.user || null);
        window.__SUPABASE_CURRENT_USER__ = mapped;
        callback(mapped);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
        if (checkAppVersion(session)) return;
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
    // Profile data changed (e.g. specialization) - refresh the cached user
    // list so every table picks the edit up on its next load.
    _usersCache = null; _usersCacheAt = 0;
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
    // Registering the patient at an institute counts as a visit to it:
    // the institutes-visited list updates automatically (only when this
    // institute is not already recorded for the patient).
    try {
        const inst = row.institute || row.institution;
        if (inst && data.id) {
            const { data: existing } = await supabase.from(T.INSTITUTES_VISITED)
                .select('id').eq('patient_id', data.id).ilike('institute', inst).limit(1);
            if (!existing || !existing.length) {
                let profName = null;
                try {
                    const up = await getUserProfile(user.uid);
                    if (up) profName = [up.surname, up.fullName].filter(Boolean).map(s => String(s).trim()).join(' ') || null;
                } catch (e) { /* best-effort */ }
                const now = new Date();
                const hhmm = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
                await supabase.from(T.INSTITUTES_VISITED).insert({
                    patient_id: data.id,
                    patient_name: row.full_name,
                    patient_surname: row.surname,
                    patient_id_passport: row.id_passport || null,
                    institute: inst,
                    date: now.toISOString().split('T')[0],
                    time: hhmm,
                    doctor_name: profName || null,
                    reason: 'Patient registered',
                    created_at: nowIso()
                });
            }
        }
    } catch (e) { console.warn('institutes_visited registration record failed:', e); }
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
    // Institution: from the form, else the patient record, else the booker's institute.
    let institution = src.institution || null;
    if (!institution) {
        try {
            const patient = await getPatient(src.patientId || src.patient_id);
            institution = (patient && (patient.institution || patient.institute)) || null;
        } catch (e) { /* best-effort */ }
    }
    if (!institution) {
        try {
            const prof = await getUserProfile(user.uid);
            institution = (prof && prof.institute) || null;
        } catch (e) { /* best-effort */ }
    }
    // Double-booking guard: the same doctor cannot hold two appointments
    // at the same date and time.
    if (doctor && src.date && src.time) {
        const { data: clash } = await supabase.from(T.APPOINTMENTS)
            .select('id')
            .eq('doctor_specialist', doctor)
            .eq('date', src.date)
            .eq('time', String(src.time).slice(0, 5))
            .in('status', ['scheduled', 'completed']);
        if (clash && clash.length) {
            throw new Error(`Double booking: ${doctor} already has an appointment on ${src.date} at ${String(src.time).slice(0, 5)}. Please choose another time.`);
        }
    }
    const data = await insertRow(T.APPOINTMENTS, {
        patient_id: src.patientId || src.patient_id || null,
        patient_user_id: src.patientUserId || null,
        patient_name: src.patientName || src.fullName || null,
        patient_surname: src.patientSurname || src.surname || null,
        patient_dob: src.patientDob || src.dob || null,
        patient_id_passport: src.patientIdPassport || null,
        doctor_specialist: doctor,
        institution: institution,
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
    // Note: institutes_visited is NOT recorded when the appointment is made.
    // A visit is only recorded (with full details) once staff confirm the
    // patient's attendance - see confirmAppointmentAttendance().
    return { id: data.id, ...src, institution };
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
    const unique = list.filter(a => { if (seen.has(a.id)) return false; seen.add(a.id); return true; });
    return resolveDoctorSpecializations(unique);
}

export async function getPatientAppointments(patientId) {
    const rows = await collectPatientHistoryRows(T.APPOINTMENTS, 'patient_id_passport', patientId);
    return rows.sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')));
}

export async function getUpcomingAppointments(days = 30) {
    const appointments = await getMyAppointments();
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const future = new Date(today); future.setDate(today.getDate() + days); future.setHours(23, 59, 59, 999);
    return appointments.filter(apt => {
        const aptDate = new Date(apt.date);
        return !isNaN(aptDate) && aptDate >= today && aptDate <= future && (apt.status === 'scheduled' || !apt.status);
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

// Staff only: confirm that the patient actually visited for this appointment.
// Only possible once the appointment date has arrived (is due). The database
// guard (trg_attendance_guard) additionally blocks patients from flipping the flag.
export async function confirmAppointmentAttendance(appointmentId) {
    const user = requireUser();
    let profile = null;
    try { profile = await getUserProfile(user.uid); } catch (e) { /* ignore */ }
    if (!profile || !['receptionist', 'medical_staff', 'specialist'].includes(profile.role)) {
        throw new Error('Only clinic staff can confirm attendance.');
    }
    const { data: row, error } = await supabase.from(T.APPOINTMENTS)
        .select('*').eq('id', appointmentId).maybeSingle();
    if (error) throw error;
    if (!row) throw new Error('Appointment not found');
    // Attendance may only be confirmed AFTER the appointment's date AND time.
    const aptDate = String(row.date || '').slice(0, 10);
    const aptTime = String(row.time || '00:00').slice(0, 5);
    const aptDateTime = new Date(`${aptDate}T${aptTime}`);
    if (aptDate && !isNaN(aptDateTime.getTime()) && aptDateTime.getTime() > Date.now()) {
        throw new Error(`Attendance can only be confirmed after the appointment's date and time (${aptDate} ${aptTime}).`);
    }
    await supabase.from(T.APPOINTMENTS).update({
        attendance_confirmed: true,
        confirmed_by: user.uid,
        confirmed_by_email: user.email,
        confirmed_at: nowIso()
    }).eq('id', appointmentId);
    // The visit now counts as real - record the institute visit with full
    // details (name, ID/Passport, institute, date, doctor) so the patient's
    // institutes-visited table only ever shows complete, real visits.
    try {
        await insertRow(T.INSTITUTES_VISITED, {
            patient_id: row.patient_id || null,
            patient_name: row.patient_name || null,
            patient_surname: row.patient_surname || null,
            patient_id_passport: row.patient_id_passport || null,
            institute: row.institution || null,
            date: row.date || null,
            time: row.time || null,
            doctor_name: row.doctor_specialist || null,
            reason: row.reason || null,
            created_at: nowIso()
        });
    } catch (e) { console.warn('institutes_visited record failed:', e); }
    return { id: appointmentId, attendanceConfirmed: true, confirmedBy: user.uid, confirmedAt: nowIso() };
}

// Confirmed-attendance visits for a patient - used to gate invoice generation
// (an invoice may only be issued for a visit the patient actually attended).
export async function getConfirmedAppointmentsForPatient(patientId) {
    requireUser();
    if (!patientId) return [];
    const { data, error } = await supabase.from(T.APPOINTMENTS)
        .select('*')
        .eq('patient_id', patientId)
        .eq('attendance_confirmed', true)
        .order('date', { ascending: false, nullsFirst: false })
        .order('confirmed_at', { ascending: false })
        .limit(50);
    if (error) throw error;
    return (data || []).map(a => ({
        ...a,
        patientId: a.patient_id,
        patientName: a.patient_name,
        patientSurname: a.patient_surname,
        patientIdPassport: a.patient_id_passport,
        doctorSpecialist: a.doctor_specialist,
        attendanceConfirmed: a.attendance_confirmed,
        confirmedByEmail: a.confirmed_by_email,
        confirmedAt: a.confirmed_at
    }));
}

export async function rescheduleAppointment(appointmentId, date, time) {
    const { data: row } = await supabase.from(T.APPOINTMENTS).select('*').eq('id', appointmentId).maybeSingle();
    if (!row) throw new Error('Appointment not found');
    // Reschedules are only allowed BEFORE the appointment's due date.
    const today = new Date().toISOString().split('T')[0];
    const aptDate = String(row.date || '').slice(0, 10);
    if (aptDate && aptDate <= today) {
        throw new Error(`This appointment's date (${aptDate}) has already arrived - it can no longer be rescheduled.`);
    }
    if (row.doctor_specialist && date && time) {
        const { data: clash } = await supabase.from(T.APPOINTMENTS)
            .select('id')
            .eq('doctor_specialist', row.doctor_specialist)
            .eq('date', date)
            .eq('time', String(time).slice(0, 5))
            .in('status', ['scheduled', 'completed'])
            .neq('id', appointmentId);
        if (clash && clash.length) {
            throw new Error(`Double booking: ${row.doctor_specialist} already has an appointment on ${date} at ${String(time).slice(0, 5)}.`);
        }
    }
    await updateRow(T.APPOINTMENTS, appointmentId, { date, time });
}

export async function deleteAppointment(appointmentId) {
    await deleteRow(T.APPOINTMENTS, appointmentId);
}

// The documents bucket enforces a mime whitelist. Phones often misreport a
// file's mime type (e.g. "text/plain;charset=UTF-8" for a PDF picked from
// WhatsApp/downloads), which the bucket rejects with "mime type ... is not
// supported". Derive the type from the extension and send it explicitly.
const DOC_MIME_BY_EXT = {
    pdf: 'application/pdf',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
};

export async function uploadDocument(a, b, c, d) {
    const user = requireUser();
    // Two calling conventions exist in the codebase:
    //   uploadDocument(patientId, file, category)
    //   uploadDocument(staffUid, patientId, file, category)   <- staff dashboards
    // Detect which one by finding the actual File argument.
    const isFile = v => v instanceof File || (v && typeof v === 'object' &&
        typeof v.name === 'string' && typeof v.size === 'number' && typeof v.type === 'string');
    let patientId, file, category = 'general';
    if (isFile(b)) { patientId = a; file = b; category = c || 'general'; }
    else if (isFile(c)) { patientId = b; file = c; category = d || 'general'; }
    else throw new Error('No file selected for upload.');
    if (!patientId) throw new Error('Please select a patient first.');
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    const mime = DOC_MIME_BY_EXT[ext];
    if (!mime) {
        throw new Error('Unsupported file type. Please upload a PDF, JPG, PNG, DOC or DOCX file.');
    }
    const uploadFile = new File([file], file.name, { type: mime });
    const path = `documents/${patientId}/${Date.now()}_${file.name}`;
    const { error } = await supabase.storage.from('documents').upload(path, uploadFile, { upsert: true, contentType: mime });
    if (error) throw error;
    const { data: pub } = supabase.storage.from('documents').getPublicUrl(path);
    const fileUrl = pub.publicUrl;
    const patient = await getPatient(patientId);
    const rec = await insertRow(T.DOCUMENTS, {
        patient_id: patientId,
        patient_user_id: patient?.patient_user_id || patient?.patientUserId || null,
        id_passport: patient?.idPassport || null,
        file_name: file.name,
        file_url: fileUrl,
        file_size: file.size,
        file_type: mime,
        category,
        uploaded_by: user.uid,
        uploaded_by_email: user.email,
        upload_date: new Date().toISOString().split('T')[0],
        created_at: nowIso()
    });
    return { id: rec.id, fileName: file.name, fileUrl, category };
}

export async function getPatientDocuments(patientId) {
    return collectPatientHistoryRows(T.DOCUMENTS, 'id_passport', patientId);
}

export async function getMyDocuments() {
    requireUser();
    // RLS returns own uploads + (for staff) documents from the same institute.
    const { data, error } = await supabase.from(T.DOCUMENTS)
        .select('*').order('upload_date', { ascending: false, nullsFirst: false }).order('created_at', { ascending: false });
    if (error) throw error;
    const rows = data || [];
    // Enrich with the patient's name (documents store patient_id, not the name).
    try {
        const ids = [...new Set(rows.map(d => d.patient_id).filter(Boolean))];
        if (ids.length) {
            const { data: pats } = await supabase.from(T.PATIENTS).select('id, full_name, surname').in('id', ids);
            const pmap = new Map((pats || []).map(p => [p.id, p]));
            rows.forEach(d => {
                const p = pmap.get(d.patient_id);
                if (p) { d.patientName = p.full_name; d.patientSurname = p.surname; }
            });
        }
    } catch (e) { /* best-effort */ }
    return rows.map(d => ({ ...d, patientId: d.patient_id, fileName: d.file_name, fileUrl: d.file_url,
        fileSize: d.file_size, fileType: d.file_type, uploadDate: d.upload_date, uploadedBy: d.uploaded_by }));
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

function camelMedRecord(m) {
    return { ...m, patientId: m.patient_id, patientName: m.patient_name, patientSurname: m.patient_surname,
              patientIdPassport: m.patient_id_passport, medicationName: m.medication_name,
              administeredBy: m.administered_by };
}

export async function recordMedicationAdministration(a, b) {
    const user = requireUser();
    const data = (b && typeof b === 'object') ? b : a;
    let patient = null;
    const patientId = data.patientId || null;
    if (patientId) { try { patient = await getPatient(patientId); } catch (e) { /* best-effort */ } }
    let prof = null;
    try { prof = await getUserProfile(user.uid); } catch (e) { /* best-effort */ }
    const institute = (prof && prof.institute) || (patient && (patient.institution || patient.institute)) || null;
    const rec = await insertRow(T.MEDICATION_RECORDS, {
        patient_id: patientId,
        patient_name: patient ? (patient.fullName || null) : null,
        patient_surname: patient ? (patient.surname || null) : null,
        patient_id_passport: (patient && patient.idPassport) || null,
        date: data.date,
        ailment: data.ailment || null,
        treatment: data.treatment || null,
        prescription: data.prescription || null,
        medication_name: data.medicationName || null,
        strength: data.strength || null,
        quantity: data.quantity ?? null,
        notes: data.notes || null,
        institute,
        administered_by: user.uid,
        administered_by_email: user.email,
        created_at: nowIso()
    });
    // Keep the inventory in sync automatically: deduct the administered
    // quantity from the matching stock item, and if no stock item exists yet,
    // create one so "Left in Stock" always has data to show.
    try {
        if (data.medicationName) {
            const norm = s => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');
            const name = norm(data.medicationName);
            const qty = data.quantity ? Number(data.quantity) : 0;
            const { data: invRows } = await supabase.from(T.MEDICATION_INVENTORY)
                .select('*').limit(200);
            const rows = invRows || [];
            let inv = rows.find(r => norm(r.medication_name) === name &&
                (!r.strength || !data.strength || norm(r.strength) === norm(data.strength))) ||
                rows.find(r => { const n = norm(r.medication_name); return n && (n.includes(name) || name.includes(n)); });
            if (inv) {
                // Stock is the source of truth: every administration reduces
                // the Manage Inventory quantity (20 recorded, 3 given -> 17),
                // and the "Left in Stock" column reflects the updated stock.
                if (qty) {
                    await supabase.from(T.MEDICATION_INVENTORY).update({
                        quantity: Math.max(0, (Number(inv.quantity) || 0) - qty),
                        updated_by: user.uid, updated_at: nowIso()
                    }).eq('id', inv.id);
                }
            } else {
                await insertRow(T.MEDICATION_INVENTORY, {
                    medication_name: data.medicationName,
                    strength: data.strength || null,
                    quantity: 0,
                    institute,
                    updated_by: user.uid,
                    updated_at: nowIso(),
                    created_at: nowIso()
                });
            }
        }
    } catch (e) { console.warn('inventory sync failed:', e); }
    return { id: rec.id, ...data };
}

export async function getMyMedicationRecords() {
    requireUser();
    // RLS returns own records + (for staff) records from the same institute.
    const { data, error } = await supabase.from(T.MEDICATION_RECORDS)
        .select('*').order('date', { ascending: false, nullsFirst: false }).order('created_at', { ascending: false });
    if (error) throw error;
    await backfillPatientDetails(data || [], { details: true });
    return (data || []).map(camelMedRecord);
}

export async function updateMedicationRecord(recordId, data) {
    const row = {};
    const put = (k, v) => { if (v !== undefined) row[k] = v; };
    put('date', data.date);
    put('quantity', data.quantity);
    put('prescription', data.prescription);
    put('ailment', data.ailment);
    put('treatment', data.treatment);
    put('medication_name', data.medicationName);
    put('strength', data.strength);
    put('notes', data.notes);
    const { error } = await supabase.from(T.MEDICATION_RECORDS).update(row).eq('id', recordId);
    if (error) throw error;
    return { id: recordId, ...data };
}

export async function deleteMedicationRecord(recordId) {
    await deleteRow(T.MEDICATION_RECORDS, recordId);
}

export async function updateMedicationInventory(inventoryData) {
    const user = requireUser();
    let prof = null;
    try { prof = await getUserProfile(user.uid); } catch (e) { /* best-effort */ }
    const institute = (prof && prof.institute) || null;
    const items = (inventoryData && inventoryData.medications) || [];
    for (const item of items) {
        if (!item.name) continue;
        const { error } = await supabase.from(T.MEDICATION_INVENTORY).upsert({
            medication_name: item.name,
            strength: item.strength || null,
            quantity: item.quantity || 0,
            expiry: item.expiry || null,
            institute,
            updated_by: user.uid,
            updated_at: nowIso()
        }, { onConflict: 'institute,medication_name,strength' });
        if (error) throw error;
    }
    return { saved: items.length };
}

export async function getMedicationInventory() {
    requireUser();
    // RLS scopes to the caller's own institute.
    const { data, error } = await supabase.from(T.MEDICATION_INVENTORY)
        .select('*').order('medication_name', { ascending: true });
    if (error) throw error;
    return data || [];
}

let prescNoIdCol = false;

export async function addPrescription(a, b) {
    const user = requireUser();
    // Two calling conventions exist:
    //   addPrescription(data)
    //   addPrescription(staffUid, data)   <- specialist dashboard
    const data = (b && typeof b === 'object') ? b : a;
    // Carry the selected patient's details onto the prescription row.
    let patient = null;
    const patientId = data.patientId || data.patient_id || null;
    if (patientId) {
        try { patient = await getPatient(patientId); } catch (e) { /* best-effort */ }
    }
    // The logged-in staff member's profile is used for the doctor name and
    // the institute (a nurse at Windhoek Central never types the institute).
    let prof = null;
    try { prof = await getUserProfile(user.uid); } catch (e) { /* best-effort */ }
    // Doctor name: explicit, or the prescriber's own name when they are a specialist.
    let doctorName = data.doctorName || data.doctor_name || null;
    if (!doctorName && prof && prof.role === 'specialist') {
        doctorName = [prof.surname, prof.fullName].filter(Boolean).map(s => String(s).trim()).join(' ') || null;
    }
    const base = {
        patient_id: patientId,
        patient_name: data.patientName || (patient && patient.fullName) || null,
        patient_surname: data.patientSurname || (patient && patient.surname) || null,
        patient_dob: data.patientDob || (patient && patient.dob) || null,
        patient_phone: data.cellPhone || (patient && (patient.cellphone || patient.phone)) || null,
        patient_user_id: data.patientUserId || (patient && (patient.patientUserId || patient.patient_user_id)) || null,
        doctor_name: doctorName,
        institute: data.institute || (prof && prof.institute) || (patient && (patient.institution || patient.institute)) || null,
        date: data.date,
        ailment: data.ailment,
        treatment: data.treatment,
        prescription: data.prescription,
        report: data.report,
        next_available_date: data.nextAvailableDate || data.next_available_date || null,
        status: data.status || 'active',
        prescribed_by: user.uid,
        prescribed_by_email: user.email,
        created_at: nowIso()
    };
    // The ailment & treatment is recorded once, below, after the prescription
    // is saved (recording it here too would create duplicate rows).
    // patient_id_passport is added by a one-time SQL migration; insert with it
    // when available, and fall back to without it until the migration has run.
    let rec;
    if (!prescNoIdCol) {
        try {
            rec = await insertRow(T.PRESCRIPTIONS, { ...base, patient_id_passport: (patient && patient.idPassport) || null });
        } catch (e) {
            if (e && /patient_id_passport/.test(String(e.message || e))) {
                prescNoIdCol = true;
                rec = await insertRow(T.PRESCRIPTIONS, base);
            } else throw e;
        }
    } else {
        rec = await insertRow(T.PRESCRIPTIONS, base);
    }
    // Record the ailment/treatment (best-effort) so it appears on the
    // patient's ailments & treatments tables. Note: institutes_visited is
    // NOT auto-recorded here - visits only appear when they are actually
    // scheduled (appointments), never silently.
    try {
        let prof = null;
        try { prof = await getUserProfile(user.uid); } catch (e2) { /* ignore */ }
        const inst = (patient && (patient.institution || patient.institute)) || (prof && prof.institute) || null;
        if (data.ailment) {
            await insertRow(T.AILMENTS_TREATMENTS, {
                patient_id: patientId,
                patient_name: (patient && patient.fullName) || null,
                patient_surname: (patient && patient.surname) || null,
                patient_id_passport: (patient && patient.idPassport) || null,
                date: data.date || null,
                ailment: data.ailment,
                treatment: data.treatment || null,
                doctor_name: doctorName,
                institute: inst,
                created_at: nowIso()
            });
        }
    } catch (e) { console.warn('ailment record failed:', e); }
    return {
        id: rec.id,
        patientId: rec.patient_id, patientName: rec.patient_name, patientSurname: rec.patient_surname,
        patientDob: rec.patient_dob, patientUserId: rec.patient_user_id,
        patientIdPassport: rec.patient_id_passport, doctorName: rec.doctor_name,
        date: rec.date, ailment: rec.ailment, treatment: rec.treatment,
        prescription: rec.prescription, report: rec.report, status: rec.status
    };
}

function camelPrescription(p) {
    return {
        ...p,
        patientId: p.patient_id,
        patientUserId: p.patient_user_id,
        patientName: p.patient_name,
        patientSurname: p.patient_surname,
        patientDob: p.patient_dob,
        patientPhone: p.patient_phone,
        patientIdPassport: p.patient_id_passport,
        doctorName: p.doctor_name,
        prescribedBy: p.prescribed_by
    };
}

export async function getMyPrescriptions() {
    const user = requireUser();
    let profile = null;
    try { profile = await getUserProfile(user.uid); } catch (e) { /* ignore */ }
    if (profile && profile.role === 'patient') {
        // Patient: RLS returns only prescriptions written FOR them
        // (matched by patient_user_id or patient_id_passport).
        const { data, error } = await supabase.from(T.PRESCRIPTIONS)
            .select('*').order('date', { ascending: false }).order('created_at', { ascending: false });
        if (error) throw error;
        await backfillPatientDetails(data || [], { details: true, phone: true });
        return resolveDoctorSpecializations((data || []).map(camelPrescription));
    }
    const rows = await selectEq(T.PRESCRIPTIONS, 'prescribed_by', user.uid);
    await backfillPatientDetails(rows, { details: true, phone: true });
    return resolveDoctorSpecializations(rows.map(camelPrescription));
}

export async function getPatientPrescriptions(patientUserId) {
    return (await selectEq(T.PRESCRIPTIONS, 'patient_user_id', patientUserId)).map(camelPrescription);
}

// ============ Full medical history retrieval (staff/doctors) ============
// All lookups are RLS-scoped: staff only see data of their own institute.
export async function getPrescriptionsForPatient(patientId) {
    if (!patientId) return [];
    const rows = await collectPatientHistoryRows(T.PRESCRIPTIONS, 'patient_id_passport', patientId);
    await backfillPatientDetails(rows, { details: true, phone: true });
    return resolveDoctorSpecializations(rows.map(camelPrescription));
}
export async function getPatientAilments(patientId) {
    if (!patientId) return [];
    const rows = (await collectPatientHistoryRows(T.AILMENTS_TREATMENTS, 'patient_id_passport', patientId)).map(camelAilment);
    // Older prescriptions recorded some ailments twice - drop exact duplicates.
    const seen = new Set();
    const out = rows.filter(r => {
        const key = `${String(r.ailment || '').toLowerCase()}|${String(r.treatment || '').toLowerCase()}|${r.date || ''}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
    return resolveDoctorSpecializations(out);
}
export async function getPatientReports(patientId) {
    if (!patientId) return [];
    const rows = await collectPatientHistoryRows(T.REPORTS, 'patient_id_passport', patientId);
    await backfillPatientDetails(rows);
    rows.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
    return resolveDoctorSpecializations((await resolveReportDoctors(rows)).map(camelReport));
}
export async function getPatientRefills(patientId) {
    if (!patientId) return [];
    const rows = await collectPatientHistoryRows(T.REFILL_REQUESTS, 'patient_id_passport', patientId);
    return resolveDoctorSpecializations(await backfillRefillPrescData(rows));
}
export async function getPatientInstitutes(patientId) {
    const rows = await collectPatientHistoryRows(T.INSTITUTES_VISITED, 'patient_id_passport', patientId);
    return rows.map(camelInstitute).sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
}
export async function getPatientInvoices(patientId) {
    if (!patientId) return [];
    const rows = await collectPatientHistoryRows(T.INVOICES, 'id_passport', patientId);
    await backfillPatientDetails(rows);
    rows.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
    const data = rows; const error = null;
    return resolveDoctorSpecializations((data || []).map(i => ({
        id: i.id, patientId: i.patient_id, patientName: i.patient_name, patientSurname: i.patient_surname,
        invoiceNumber: i.invoice_number, date: i.date, reason: i.reason, prescription: i.prescription,
        treatment: i.treatment, fee: i.fee, paid: i.paid, status: i.status,
        idPassport: i.id_passport, cellPhone: i.cell_phone,
        pdfUrl: i.pdf_url, createdBy: i.created_by, createdAt: i.created_at,
        appointmentId: i.appointment_id, institute: i.institute, doctorName: i.doctor_name
    })));
}
export async function getPatientPayments(patientId) {
    if (!patientId) return [];
    const rows = await collectPatientHistoryRows(T.PAYMENTS, 'id_passport', patientId);
    rows.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
    const data = rows; const error = null;
    return (data || []).map(p => ({
        id: p.id, date: p.date, patientName: p.patient_name, patientSurname: p.patient_surname,
        idPassport: p.id_passport, amount: p.amount, method: p.method, reference: p.reference,
        status: p.status, processedBy: p.processed_by, createdAt: p.created_at
    }));
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

// ============ UNIFIED PDF STYLING ============
// Every generated document (invoice, prescription, report, insurance,
// payment receipt) follows the invoice look: brand-colour header band,
// coloured table header, grid lines, N/A for missing values.
const PDF_BRAND = [0, 102, 204];          // #0066cc
const PDF_BRAND_DARK = [0, 60, 110];
const PDF_HEADER_H = 28;                   // header band height (mm)
const PDF_NA = v => (v === null || v === undefined || String(v).trim() === '') ? 'N/A' : String(v);

let jspdfPromise = null;
// Load the PDF library on demand (works even if the page's <script> tag
// failed to load first, e.g. on a slow network).
function ensureJsPdf() {
    if (window.jspdf) return Promise.resolve(window.jspdf);
    if (!jspdfPromise) {
        jspdfPromise = new Promise((resolve, reject) => {
            const s = document.createElement('script');
            s.src = 'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js';
            s.onload = () => (window.jspdf ? resolve(window.jspdf) : reject(new Error('PDF library failed to load')));
            s.onerror = () => { jspdfPromise = null; reject(new Error('PDF library could not be loaded - check your internet connection and try again')); };
            document.head.appendChild(s);
        });
    }
    return jspdfPromise;
}

// Open the generated PDF in a NEW TAB first, then start the download from
// that tab - the current page is never redirected or navigated away.
export async function previewAndSavePdf(blob, filename) {
    const url = URL.createObjectURL(blob);
    const safe = String(filename || 'document.pdf').replace(/["<>\\]/g, '');
    let win = null;
    try { win = window.open('', '_blank'); } catch (e) { win = null; }
    if (win) {
        try {
            const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${safe}</title></head>` +
                `<body style="margin:0;height:100vh;">` +
                `<iframe src="${url}" style="border:0;width:100%;height:100vh;" title="PDF preview"></iframe>` +
                `<a id="autoDl" href="${url}" download="${safe}" style="display:none;"></a>` +
                `<script>setTimeout(function(){try{document.getElementById('autoDl').click();}catch(e){}},800);<\/script>` +
                `</body></html>`;
            win.document.open();
            win.document.write(html);
            win.document.close();
        } catch (e) {
            try { win.location.href = url; } catch (e2) { /* preview unavailable */ }
        }
        setTimeout(() => URL.revokeObjectURL(url), 120000);
        return url;
    }
    // Popup blocked (rare on a direct button click) - fall back to a plain
    // download so the file is not lost.
    const a = document.createElement('a');
    a.href = url;
    a.download = safe;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    return url;
}

function pdfHeader(doc, title, subtitle) {
    doc.setFillColor(...PDF_BRAND);
    doc.rect(0, 0, 210, PDF_HEADER_H, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(18);
    doc.text(title, 14, 12);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
    doc.text(subtitle || 'Namibia Health Services', 14, 20);
    doc.text(new Date().toLocaleDateString('en-GB'), 196, 12, { align: 'right' });
    doc.setTextColor(30, 30, 30);
}
function pdfField(doc, y, label, value) {
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(label + ':', 14, y);
    doc.setFont('helvetica', 'normal');
    doc.text(PDF_NA(value), 62, y);
    return y + 8;
}
function pdfRule(doc, y, color = PDF_BRAND, width = 0.4) {
    doc.setDrawColor(...color);
    doc.setLineWidth(width);
    doc.line(14, y, 196, y);
    doc.setLineWidth(0.2);
    return y;
}
// coloured header + zebra rows + grid lines; cols = [{ label, width, align, key }]
function pdfGridTable(doc, startY, cols, rows, { rowH = 8 } = {}) {
    let y = startY;
    doc.setFillColor(227, 242, 253);
    doc.rect(14, y, 182, rowH, 'F');
    doc.setDrawColor(...PDF_BRAND); doc.setLineWidth(0.3);
    doc.rect(14, y, 182, rowH);
    let hx = 14;
    cols.forEach(c => { hx += c.width; doc.line(hx, y, hx, y + rowH); });
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...PDF_BRAND_DARK);
    let x = 16;
    cols.forEach(c => { doc.text(c.label, x, y + 5.5, c.align === 'right' ? { align: 'right' } : {}); x += c.width; });
    y += rowH;
    doc.setTextColor(30, 30, 30); doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
    rows.forEach((r, i) => {
        const cells = cols.map(c => doc.splitTextToSize(PDF_NA(r[c.key]), c.width - 5));
        const h = Math.max(rowH, Math.max(...cells.map(c => c.length)) * 5.2 + 5);
        if (i % 2 === 1) { doc.setFillColor(245, 248, 252); doc.rect(14, y, 182, h, 'F'); }
        doc.setDrawColor(150, 175, 200); doc.setLineWidth(0.2);
        doc.rect(14, y, 182, h);
        let vx = 14;
        cols.forEach(c => { vx += c.width; doc.line(vx, y, vx, y + h); });
        x = 16;
        cells.forEach((lines, ci) => {
            doc.text(lines, x, y + 6, cols[ci].align === 'right' ? { align: 'right' } : {});
            x += cols[ci].width;
        });
        y += h;
    });
    doc.setDrawColor(...PDF_BRAND); doc.setLineWidth(0.5);
    doc.rect(14, startY, 182, y - startY);
    doc.setLineWidth(0.2);
    return y;
}
function pdfFooter(doc, note) {
    pdfRule(doc, 285, [150, 150, 150], 0.3);
    doc.setFontSize(9); doc.setTextColor(120);
    doc.text(note || 'Generated by Namibia Health Services', 14, 291);
    doc.setTextColor(30, 30, 30);
}

async function buildReportPdf({ type, patientName, patientSurname, idPassport, date, description, doctorName, institute }) {
    await ensureJsPdf();
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    pdfHeader(doc, 'MEDICAL REPORT', (institute || 'Namibia Health Services') + (type ? ' - ' + type : ''));
    let y = 40;
    y = pdfField(doc, y, 'Patient', `${patientName || ''} ${patientSurname || ''}`.trim());
    y = pdfField(doc, y, 'ID/Passport', idPassport);
    y = pdfField(doc, y, 'Date', date);
    y = pdfField(doc, y, 'Staff / Doctor', doctorName);
    y += 4;
    pdfRule(doc, y);
    pdfGridTable(doc, y + 2, [{ label: 'Report', width: 182, key: 'text' }], [{ text: description }]);
    pdfFooter(doc);
    return doc.output('blob');
}

export async function generateReport(a, b) {
    const user = requireUser();
    const data = (b && typeof b === 'object') ? b : a;
    let patient = null;
    const patientId = data.patientId || null;
    if (patientId) { try { patient = await getPatient(patientId); } catch (e) { /* best-effort */ } }
    let prof = null;
    try { prof = await getUserProfile(user.uid); } catch (e) { /* best-effort */ }
    // A report made by a doctor carries the doctor's name; a report made by
    // anyone else is labelled 'Receptionist' / 'Staff' - never left as TBA.
    const doctorName = data.doctorName || (prof
        ? (prof.role === 'specialist'
            ? ([prof.surname, prof.fullName].filter(Boolean).map(s => String(s).trim()).join(' ') || 'Staff')
            : (prof.role === 'receptionist' ? 'Receptionist' : 'Staff'))
        : 'Staff');
    const institute = (prof && prof.institute) || (patient && (patient.institution || patient.institute)) || null;
    let pdfUrl = null;
    try {
        const blob = await buildReportPdf({
            type: data.type, patientName: patient && patient.fullName, patientSurname: patient && patient.surname,
            idPassport: (patient && patient.idPassport) || null, date: data.date,
            description: data.description, doctorName, institute
        });
        const fname = `Report-${(data.type || 'report').replace(/\s+/g, '-')}-${Date.now()}.pdf`;
        // Saving path starts with the patient's ID / Passport number
        const pathStart = (patient && patient.idPassport) || patientId || 'general';
        const path = `reports/${pathStart}/${Date.now()}_${fname}`;
        const file = new File([blob], fname, { type: 'application/pdf' });
        const { error: upErr } = await supabase.storage.from('documents').upload(path, file, { upsert: true, contentType: 'application/pdf' });
        if (!upErr) {
            const { data: pub } = supabase.storage.from('documents').getPublicUrl(path);
            pdfUrl = pub.publicUrl;
        }
    } catch (e) { console.warn('report PDF failed:', e); }
    const rec = await insertRow(T.REPORTS, {
        type: data.type || null,
        patient_id: patientId,
        patient_name: patient ? (patient.fullName || null) : null,
        patient_surname: patient ? (patient.surname || null) : null,
        patient_id_passport: (patient && patient.idPassport) || null,
        date: data.date,
        description: data.description || null,
        doctor_name: doctorName,
        pdf_url: pdfUrl,
        institute,
        generated_by: user.uid,
        generated_by_email: user.email,
        created_at: nowIso(),
        updated_at: nowIso()
    });
    return camelReport(rec);
}

function camelReport(r) {
    return { ...r, patientId: r.patient_id, patientName: r.patient_name, patientSurname: r.patient_surname,
             patientIdPassport: r.patient_id_passport, idPassport: r.patient_id_passport,
             doctorName: r.doctor_name, pdfUrl: r.pdf_url,
             generatedBy: r.generated_by, generatedByEmail: r.generated_by_email };
}

function normDocName(s) {
    return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
}
// Best-effort: match the doctor name on each row against registered users so
// we can show the doctor's specialization (e.g. "Doctor of Cardiology").
let _usersCache = null;
let _usersCacheAt = 0;
async function getUsersCached() {
    const now = Date.now();
    if (_usersCache && now - _usersCacheAt < 2 * 60 * 1000) return _usersCache;
    try {
        const { data } = await supabase.from(T.USERS).select('full_name, surname, profession, speciality, institute');
        _usersCache = data || [];
        _usersCacheAt = now;
    } catch (e) { /* cannot read users - degrade gracefully */ }
    return _usersCache || [];
}
function stripDoctorTitle(s) {
    return String(s || '').replace(/\b(d\.)?r\.|\bdr\b|\b(d\.)?r\.|\bprof\b|\bprof\.\b|\bmr\b|\bms\b/gi, ' ');
}
async function resolveDoctorSpecializations(rows) {
    rows.forEach(r => (r.specialization = null));
    if (!rows.length) return rows;
    const users = await getUsersCached();
    for (const r of rows) {
        const dnRaw = normDocName(r.doctorName);
        if (!dnRaw) continue;
        const dn = normDocName(stripDoctorTitle(r.doctorName));
        for (const u of users) {
            const full = normDocName(stripDoctorTitle(`${u.full_name || ''} ${u.surname || ''}`));
            const sur = normDocName(u.surname);
            const first = normDocName(u.full_name);
            let hit = false;
            if (full.length >= 4) hit = dn.includes(full) || (dn.length >= 4 && full.includes(dn));
            if (!hit && dnRaw.length >= 4 && full.length >= 4) hit = dnRaw.includes(full) || full.includes(dnRaw);
            if (!hit && sur.length >= 4 && first.length >= 3) hit = dn.includes(sur) && dn.includes(first);
            if (!hit && sur.length >= 5) hit = dn.includes(sur) || (dn.length >= 4 && sur.includes(dn));
            if (!hit && first.length >= 5 && sur.length >= 3) hit = dn.includes(first) && dn.includes(sur);
            if (hit) {
                r.specialization = u.profession || u.speciality || null;
                // Entries that have no institute of their own take the
                // registered institute of the doctor/staff who recorded them.
                if (u.institute) {
                    if (!r.institute) r.institute = u.institute;
                    if (!r.institution) r.institution = u.institute;
                }
                break;
            }
        }
    }
    return rows;
}

// When a report has no doctor name, show who actually generated it:
// a specialist's name, or 'Receptionist' / 'Staff' - never 'TBA'.
async function resolveReportDoctors(rows) {
    const need = [...new Set(rows.filter(r => !r.doctor_name && r.generated_by).map(r => r.generated_by))];
    const names = {};
    if (need.length > 0) {
        try {
            const { data } = await supabase.from(T.USERS)
                .select('id, role, full_name, surname')
                .in('id', need);
            for (const u of data || []) names[u.id] = u;
        } catch (e) { /* best-effort */ }
    }
    for (const r of rows) {
        if (r.doctor_name) continue;
        const u = r.generated_by ? names[r.generated_by] : null;
        if (!u) { r.doctor_name = 'Staff'; continue; }
        if (u.role === 'specialist') {
            r.doctor_name = [u.surname, u.full_name].filter(Boolean).map(s => String(s).trim()).join(' ') || 'Staff';
        } else if (u.role === 'receptionist') {
            r.doctor_name = 'Receptionist';
        } else {
            r.doctor_name = 'Staff';
        }
    }
    return rows;
}

export async function getMyReports() {
    const user = requireUser();
    let profile = null;
    try { profile = await getUserProfile(user.uid); } catch (e) { /* ignore */ }
    if (profile && profile.role === 'patient') {
        const { data, error } = await supabase.from(T.REPORTS)
            .select('*').order('date', { ascending: false, nullsFirst: false }).order('created_at', { ascending: false });
        if (error) throw error;
        await backfillPatientDetails(data || []);
        return resolveDoctorSpecializations((await resolveReportDoctors(data || [])).map(camelReport));
    }
    const { data, error } = await supabase.from(T.REPORTS)
        .select('*').order('date', { ascending: false, nullsFirst: false }).order('created_at', { ascending: false });
    if (error) throw error;
    await backfillPatientDetails(data || []);
    return resolveDoctorSpecializations((await resolveReportDoctors(data || [])).map(camelReport));
}

export async function updateReport(reportId, data) {
    const row = { updated_at: nowIso() };
    if (data.type !== undefined) row.type = data.type;
    if (data.date !== undefined) row.date = data.date;
    if (data.description !== undefined) row.description = data.description;
    if (data.doctorName !== undefined) row.doctor_name = data.doctorName;
    const { error } = await supabase.from(T.REPORTS).update(row).eq('id', reportId);
    if (error) throw error;
    return { id: reportId, ...data };
}

export async function deleteReport(reportId) {
    const { data } = await supabase.from(T.REPORTS).select('*').eq('id', reportId).maybeSingle();
    if (data && data.pdf_url) {
        try {
            const marker = '/documents/';
            const idx = data.pdf_url.indexOf(marker);
            if (idx !== -1) await supabase.storage.from('documents').remove([data.pdf_url.slice(idx + marker.length)]);
        } catch (e) { console.warn('Could not delete report file:', e); }
    }
    await deleteRow(T.REPORTS, reportId);
}

export async function verifyInsurance(a, b) {
    const user = requireUser();
    const data = (b && typeof b === 'object') ? b : a;
    let patient = null;
    const patientId = data.patientId || null;
    if (patientId) { try { patient = await getPatient(patientId); } catch (e) { /* best-effort */ } }
    let prof = null;
    try { prof = await getUserProfile(user.uid); } catch (e) { /* best-effort */ }
    const status = data.status || 'verified';
    const rec = await insertRow(T.INSURANCE_VERIFICATIONS, {
        patient_id: patientId,
        patient_name: patient ? (patient.fullName || null) : null,
        patient_surname: patient ? (patient.surname || null) : null,
        patient_id_passport: (patient && patient.idPassport) || null,
        medical_aid_number: data.medicalAidNumber || data.medicalAid || null,
        date: data.date,
        payment_status: data.paymentStatus || null,
        status,
        notes: data.notes || null,
        institute: (prof && prof.institute) || (patient && (patient.institution || patient.institute)) || null,
        verified_by: user.uid,
        verified_by_email: user.email,
        created_at: nowIso()
    });
    // A verified insurance verification means the patient HAS medical
    // insurance - update the patient record automatically.
    try {
        if (status === 'verified' && patientId) {
            await supabase.from(T.PATIENTS).update({ insurance: 'Yes', updated_at: nowIso() }).eq('id', patientId);
        }
    } catch (e) { /* best-effort */ }
    return { id: rec.id, ...data, patientName: rec.patient_name, patientSurname: rec.patient_surname };
}

export async function getInsuranceVerifications() {
    const { data, error } = await supabase.from(T.INSURANCE_VERIFICATIONS)
        .select('*').order('date', { ascending: false }).order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []).map(v => ({
        ...v, patientId: v.patient_id, patientName: v.patient_name, patientSurname: v.patient_surname,
        patientIdPassport: v.patient_id_passport, medicalAidNumber: v.medical_aid_number,
        paymentStatus: v.payment_status, verifiedBy: v.verified_by
    }));
}

export async function deleteInsuranceVerification(id) {
    await deleteRow(T.INSURANCE_VERIFICATIONS, id);
}

export async function updateInsuranceVerification(id, data) {
    const row = {};
    const put = (k, v) => { if (v !== undefined) row[k] = v; };
    put('medical_aid_number', data.medicalAidNumber);
    put('date', data.date);
    put('payment_status', data.paymentStatus);
    put('status', data.status);
    put('notes', data.notes);
    const { error } = await supabase.from(T.INSURANCE_VERIFICATIONS).update(row).eq('id', id);
    if (error) throw error;
    // Verified on edit -> the patient's medical-insurance flag becomes Yes.
    try {
        if (data.status === 'verified') {
            const { data: vrow } = await supabase.from(T.INSURANCE_VERIFICATIONS).select('patient_id').eq('id', id).maybeSingle();
            if (vrow && vrow.patient_id) {
                await supabase.from(T.PATIENTS).update({ insurance: 'Yes', updated_at: nowIso() }).eq('id', vrow.patient_id);
            }
        }
    } catch (e) { /* best-effort */ }
    return { id, ...data };
}

// Guard against fast double-submits (very common on phones): if the same
// staff member creates an invoice/payment with identical key fields within
// 3 seconds, return the first result instead of creating a duplicate row.
const _recentSubmits = new Map();
function recentSubmitKey(fn, user, fields) {
    const key = fn + '|' + user + '|' + JSON.stringify(fields);
    const last = _recentSubmits.get(key);
    const now = Date.now();
    if (last && now - last.ts < 3000) return last;
    return null;
}
function rememberSubmit(fn, user, fields, result) {
    _recentSubmits.set(fn + '|' + user + '|' + JSON.stringify(fields), { ts: Date.now(), result });
}

export async function createInvoice(uid, invoiceData) {
    // Dashboards call createInvoice(currentUser.uid, data);
    // also tolerates a single-argument call createInvoice(data).
    if (uid && typeof uid === 'object') { invoiceData = uid; uid = null; }
    const user = requireUser();
    const _f = [invoiceData.patientId, invoiceData.fee, invoiceData.date, invoiceData.reason];
    const _dup = recentSubmitKey('invoice', user.uid, _f);
    if (_dup) return _dup.result;
    let patient = null;
    if (invoiceData.patientId) {
        try { patient = await getPatient(invoiceData.patientId); } catch (e) { /* patient lookup is best-effort */ }
    }
    let bookerProf = null;
    try { bookerProf = await getUserProfile(user.uid); } catch (e) { /* best-effort */ }
    const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const invoiceNumber = invoiceData.invoiceNumber || `INV-${stamp}-${String(Math.floor(Math.random() * 9000) + 1000)}`;
    const paid = invoiceData.paid === true || invoiceData.paid === 'true';
    const invRow = {
        patient_id: invoiceData.patientId || null,
        patient_name: patient ? (patient.fullName || null) : (invoiceData.patientName || null),
        patient_surname: patient ? (patient.surname || null) : (invoiceData.patientSurname || null),
        invoice_number: invoiceNumber,
        date: invoiceData.date,
        reason: invoiceData.reason || null,
        prescription: invoiceData.prescription || null,
        treatment: invoiceData.treatment || null,
        id_passport: patient ? (patient.idPassport || null) : null,
        cell_phone: patient ? (patient.cellphone || patient.phone || null) : null,
        fee: invoiceData.fee ?? 0,
        paid: paid,
        institute: invoiceData.institute || (bookerProf && bookerProf.institute) || (patient && (patient.institution || patient.institute)) || null,
        doctor_name: invoiceData.doctorName || invoiceData.doctor_name || null,
        appointment_id: invoiceData.appointmentId || invoiceData.appointment_id || null,
        status: invoiceData.status || (paid ? 'paid' : 'pending'),
        created_by: user.uid,
        created_by_email: user.email,
        created_at: nowIso()
    };
    let rec;
    try {
        rec = await insertRow(T.INVOICES, invRow);
    } catch (e) {
        if (e && /appointment_id/.test(String(e.message || e))) {
            // column not migrated yet - retry without the visit link
            const { appointment_id, ...rest } = invRow;
            rec = await insertRow(T.INVOICES, rest);
        } else throw e;
    }
    const _result = { ...rec, patientId: rec.patient_id, patientName: rec.patient_name, patientSurname: rec.patient_surname, idPassport: rec.id_passport, cellPhone: rec.cell_phone, invoiceNumber: rec.invoice_number, pdfUrl: rec.pdf_url, appointmentId: rec.appointment_id };
    rememberSubmit('invoice', user.uid, _f, _result);
    return _result;
}

export async function processPayment(uid, paymentData) {
    // Dashboards call processPayment(currentUser.uid, data);
    // also tolerates a single-argument call processPayment(data).
    if (uid && typeof uid === 'object') { paymentData = uid; uid = null; }
    const user = requireUser();
    let patient = null;
    if (paymentData.patientId) {
        try { patient = await getPatient(paymentData.patientId); } catch (e) { /* best-effort */ }
    }
    const _pf = [paymentData.patientId, paymentData.amount, paymentData.date];
    const _pdup = recentSubmitKey('payment', user.uid, _pf);
    if (_pdup) return _pdup.result;
    const rec = await insertRow(T.PAYMENTS, {
        patient_id: paymentData.patientId || null,
        patient_name: patient ? (patient.fullName || null) : null,
        patient_surname: patient ? (patient.surname || null) : null,
        id_passport: patient ? (patient.idPassport || null) : null,
        cell_phone: patient ? (patient.cellphone || patient.phone || null) : null,
        date: paymentData.date,
        amount: paymentData.amount ?? 0,
        method: paymentData.method || null,
        // Reference number = the patient's ID number (manual entry removed).
        reference: (paymentData.reference && String(paymentData.reference).trim()) || (patient && patient.idPassport) || null,
        processed_by: user.uid,
        processed_by_email: user.email,
        created_at: nowIso()
    });
    const _presult = { id: rec.id, ...paymentData };
    rememberSubmit('payment', user.uid, _pf, _presult);
    return _presult;
}


// ============ BILLING READERS (scoped by RLS: own + shared institute) ============
export async function getInvoices() {
    const { data, error } = await supabase.from(T.INVOICES)
        .select('*').order('date', { ascending: false }).order('created_at', { ascending: false });
    if (error) throw error;
    await backfillPatientDetails(data || []);
    return resolveDoctorSpecializations((data || []).map(i => ({
        id: i.id, patientId: i.patient_id, patientName: i.patient_name, patientSurname: i.patient_surname,
        invoiceNumber: i.invoice_number, date: i.date, reason: i.reason, prescription: i.prescription,
        treatment: i.treatment, fee: i.fee, paid: i.paid, status: i.status,
        idPassport: i.id_passport, cellPhone: i.cell_phone,
        pdfUrl: i.pdf_url, createdBy: i.created_by, createdAt: i.created_at,
        appointmentId: i.appointment_id, institute: i.institute, doctorName: i.doctor_name
    })));
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

export async function deleteInvoice(invoiceId) {
    const { data } = await supabase.from(T.INVOICES).select('*').eq('id', invoiceId).maybeSingle();
    if (data && data.pdf_url) {
        try {
            const marker = '/documents/';
            const idx = data.pdf_url.indexOf(marker);
            if (idx !== -1) await supabase.storage.from('documents').remove([data.pdf_url.slice(idx + marker.length)]);
        } catch (e) { console.warn('Could not delete invoice file:', e); }
        // The invoice PDF is also stored in the documents table so the patient
        // can download it - remove that row too, or the deleted invoice keeps
        // showing on the patient's Documents & Invoices and staff dashboards.
        try { await supabase.from(T.DOCUMENTS).delete().eq('file_url', data.pdf_url); }
        catch (e) { console.warn('Could not delete invoice document row:', e); }
    }
    await deleteRow(T.INVOICES, invoiceId);
}

export async function deletePayment(paymentId) {
    await deleteRow(T.PAYMENTS, paymentId);
}

// ============ PRESCRIPTION PDF (jsPDF, loaded via <script> on the pages) ============
export async function buildPrescriptionPdf(pr) {
    await ensureJsPdf();
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    pdfHeader(doc, 'PRESCRIPTION', pr.institute || 'Namibia Health Services');
    let y = 40;
    y = pdfField(doc, y, 'Patient', `${pr.patientName || ''} ${pr.patientSurname || ''}`.trim());
    y = pdfField(doc, y, 'ID/Passport', pr.patientIdPassport);
    y = pdfField(doc, y, 'Date', pr.date);
    y = pdfField(doc, y, 'Doctor / Specialist', pr.doctorName || pr.doctor_name || pr.doctorSpecialist || 'Staff');
    y += 4;
    pdfRule(doc, y);
    pdfGridTable(doc, y + 2, [
        { label: 'Ailment', width: 60, key: 'ailment' },
        { label: 'Treatment', width: 60, key: 'treatment' },
        { label: 'Next Available', width: 62, key: 'next' }
    ], [{
        ailment: pr.ailment,
        treatment: pr.treatment,
        next: pr.nextAvailableDate || pr.next_available_date
    }]);
    y += 20;
    pdfGridTable(doc, y, [
        { label: 'Prescription', width: 182, key: 'text' }
    ], [{ text: pr.prescription }]);
    y += 20;
    if (pr.report) {
        pdfGridTable(doc, y, [{ label: 'Report', width: 182, key: 'text' }], [{ text: pr.report }]);
    }
    pdfFooter(doc, 'Generated by Namibia Health Services - prescription document');
    return doc.output('blob');
}

// ============ INVOICE PDF (jsPDF, loaded via <script> on the pages) ============
export function buildInvoicePdf(invoice) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    pdfHeader(doc, 'TAX INVOICE', (invoice.institute || invoice.institution) || 'Namibia Health Services');
    doc.setTextColor(30, 30, 30);
    doc.setFontSize(12); doc.setFont('helvetica', 'bold');
    doc.text(`Invoice No: ${PDF_NA(invoice.invoiceNumber)}`, 14, 42);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(11);
    doc.text(`Date: ${PDF_NA(invoice.date ? String(invoice.date).slice(0, 10) : null)}`, 14, 50);
    doc.text(`Institute: ${PDF_NA(invoice.institute || invoice.institution)}`, 14, 58);
    doc.text(`Prescribing Doctor: ${PDF_NA(invoice.doctorName || invoice.doctor_name)}`, 14, 66);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(invoice.paid ? 27 : 198, invoice.paid ? 94 : 40, invoice.paid ? 60 : 40);
    doc.text(`Status: ${invoice.paid ? 'PAID' : 'UNPAID'}`, 196, 42, { align: 'right' });
    doc.setTextColor(30, 30, 30);
    doc.setFont('helvetica', 'normal');
    pdfRule(doc, 72);
    doc.setFont('helvetica', 'bold');
    doc.text('Billed to:', 14, 80);
    doc.setFont('helvetica', 'normal');
    doc.text(PDF_NA(`${invoice.patientName || ''} ${invoice.patientSurname || ''}`.trim()), 14, 88);
    let y = 96;
    doc.text(`ID/Passport: ${PDF_NA(invoice.idPassport)}    Phone: ${PDF_NA(invoice.cellPhone)}`, 14, y);
    y += 10;
    pdfRule(doc, y);
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
    pdfFooter(doc, 'Generated by Namibia Health Services - this is a computer-generated invoice.');
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
        patient_user_id: patient ? (patient.patient_user_id || patient.patientUserId || null) : null,
        id_passport: patient ? (patient.idPassport || null) : null,
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

function camelAilment(a) {
    return { ...a, patientName: a.patient_name, patientSurname: a.patient_surname,
             patientIdPassport: a.patient_id_passport, doctorName: a.doctor_name };
}
function camelInstitute(v) {
    return { ...v, patientName: v.patient_name, patientSurname: v.patient_surname,
              patientIdPassport: v.patient_id_passport, doctorName: v.doctor_name };
}
function camelRefill(r) {
    return { ...r, patientName: r.patient_name, patientSurname: r.patient_surname,
              patientIdPassport: r.patient_id_passport, doctorName: r.doctor_name,
              doctorNote: r.doctor_note, nextAvailableDate: r.next_available_date,
              prescriptionDate: r.prescription_date, ailment: r.ailment, treatment: r.treatment,
              prescriptionId: r.prescription_id, prescribedBy: r.prescribed_by };
}
// Old refill requests have no prescription date / ailment / treatment stored -
// recover them from the linked prescription row.
async function backfillRefillPrescData(rows) {
    const camel = rows.map(camelRefill);
    const need = [...new Set(camel
        .filter(r => r.prescriptionId && (!r.prescriptionDate || !r.ailment || !r.treatment))
        .map(r => r.prescriptionId))];
    if (need.length) {
        try {
            const { data } = await supabase.from(T.PRESCRIPTIONS)
                .select('id, date, ailment, treatment').in('id', need);
            const pmap = new Map((data || []).map(p => [p.id, p]));
            camel.forEach(r => {
                const p = r.prescriptionId ? pmap.get(r.prescriptionId) : null;
                if (!p) return;
                if (!r.prescriptionDate) r.prescriptionDate = p.date;
                if (!r.ailment) r.ailment = p.ailment;
                if (!r.treatment) r.treatment = p.treatment;
            });
        } catch (e) { /* best-effort */ }
    }
    return camel;
}
// Patient: RLS returns only their own rows (matched by ID number / link).
const TABLE_SORT_DATE = new Set([T.AILMENTS_TREATMENTS, T.INSTITUTES_VISITED, T.PRESCRIPTIONS, T.APPOINTMENTS, T.REPORTS]);
async function patientScopeSelect(table) {
    let q = supabase.from(table).select('*');
    if (TABLE_SORT_DATE.has(table)) q = q.order('date', { ascending: false, nullsFirst: false });
    q = q.order('created_at', { ascending: false });
    const { data, error } = await q;
    if (error) throw error;
    return data || [];
}

export async function getMyAilmentsTreatments() {
    const user = requireUser();
    let profile = null;
    try { profile = await getUserProfile(user.uid); } catch (e) { /* ignore */ }
    if (profile && profile.role === 'patient') {
        // Collect ailment & treatment data from the dedicated table AND from
        // the patient's prescriptions, so the table is never empty when the
        // patient has any medical history recorded.
        const [rows, presc] = await Promise.all([
            patientScopeSelect(T.AILMENTS_TREATMENTS),
            (async () => { try {
                const { data, error } = await supabase.from(T.PRESCRIPTIONS)
                    .select('*').order('date', { ascending: false, nullsFirst: false }).order('created_at', { ascending: false });
                if (error) throw error;
                return data || [];
            } catch (e) { return []; } })()
        ]);
        const merged = [];
        const seen = new Set();
        const normKey = (a, t, d) => `${String(a || '').trim().toLowerCase()}|${String(t || '').trim().toLowerCase()}|${String(d || '').slice(0, 10)}`;
        const ailmentDateKey = (a, d) => `${String(a || '').trim().toLowerCase()}|${String(d || '').slice(0, 10)}`;
        const ailmentDates = new Set();
        for (const r of rows) {
            const a = camelAilment(r);
            const key = normKey(a.ailment, a.treatment, a.date);
            if (seen.has(key)) continue;
            seen.add(key);
            if (a.ailment) ailmentDates.add(ailmentDateKey(a.ailment, a.date));
            merged.push(a);
        }
        for (const p of presc) {
            if (!p.ailment && !p.treatment) continue;
            // skip when the same ailment on the same date was already recorded
            if (p.ailment && ailmentDates.has(ailmentDateKey(p.ailment, p.date))) continue;
            const a = {
                id: 'pr-' + p.id,
                createdAt: p.created_at,
                patientId: p.patient_id,
                patientName: p.patient_name, patientSurname: p.patient_surname,
                patientIdPassport: p.patient_id_passport,
                doctorName: p.doctor_name,
                institute: p.institute,
                ailment: p.ailment || null,
                treatment: p.treatment || null,
                date: p.date || null,
                source: 'prescription'
            };
            const key = normKey(a.ailment, a.treatment, a.date);
            if (seen.has(key)) continue;
            seen.add(key);
            merged.push(a);
        }
        merged.sort((x, y) => new Date(y.date || 0) - new Date(x.date || 0));
        return resolveDoctorSpecializations(merged);
    }
    return resolveDoctorSpecializations((await selectEq(T.AILMENTS_TREATMENTS, 'patient_id', user.uid)).map(camelAilment));
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
    let profile = null;
    try { profile = await getUserProfile(user.uid); } catch (e) { /* ignore */ }
    if (profile && profile.role === 'patient') return (await patientScopeSelect(T.INSTITUTES_VISITED)).map(camelInstitute);
    return (await selectEq(T.INSTITUTES_VISITED, 'patient_id', user.uid)).map(camelInstitute);
}

export async function requestRefill(a, b) {
    const user = requireUser();
    const data = (b && typeof b === 'object') ? b : a;
    let profile = null;
    try { profile = await getUserProfile(user.uid); } catch (e) { /* ignore */ }
    // Automatic block: a refill cannot be requested before the prescription's
    // next available date.
    if (data.prescriptionId) {
        try {
            const { data: pr } = await supabase.from(T.PRESCRIPTIONS)
                .select('date, next_available_date').eq('id', data.prescriptionId).maybeSingle();
            const next = pr && pr.next_available_date;
            const today = new Date().toISOString().split('T')[0];
            if (next && today < String(next).slice(0, 10)) {
                throw new Error(`Refill requests are blocked until the next available date (${String(next).slice(0, 10)}).`);
            }
            if (!data.prescriptionDate && pr && pr.date) data.prescriptionDate = String(pr.date).slice(0, 10);
        } catch (e) {
            if (e && /blocked until/.test(String(e.message || e))) throw e;
            // best-effort lookup - do not block the request on lookup failure
        }
    }
    const rec = await insertRow(T.REFILL_REQUESTS, {
        patient_id: user.uid,
        patient_name: (profile && profile.fullName) || null,
        patient_surname: (profile && profile.surname) || null,
        patient_id_passport: (profile && profile.idPassport) || null,
        patient_email: user.email,
        prescription_id: data.prescriptionId || null,
        prescription: data.prescription || null,
        prescription_date: data.prescriptionDate || null,
        ailment: data.ailment || null,
        treatment: data.treatment || null,
        medication_name: data.medication || null,
        duration: data.duration || null,
        next_available_date: data.nextAvailableDate || null,
        notes: data.notes || null,
        prescribed_by: data.prescribedBy || null,
        doctor_name: data.doctorName || null,
        institute: (profile && profile.institute) || null,
        status: 'pending',
        created_at: nowIso()
    });
    return { id: rec.id, ...data };
}

// The prescribing doctor sees requests for their own patients (RLS-scoped).
export async function getRefillRequestsForDoctor() {
    const user = requireUser();
    const { data, error } = await supabase.from(T.REFILL_REQUESTS)
        .select('*').eq('prescribed_by', user.uid)
        .order('created_at', { ascending: false });
    if (error) throw error;
    return backfillRefillPrescData(data || []);
}

// Doctor confirms (or declines) a refill request; the note is the patient's confirmation.
export async function respondRefill(refillId, response) {
    // The DB check constraint only allows pending/approved/rejected.
    const status = response.status === 'declined' ? 'rejected' : response.status;
    let req = null;
    try { req = (await supabase.from(T.REFILL_REQUESTS).select('prescription_id, next_available_date').eq('id', refillId).maybeSingle()).data; } catch (e) { /* ignore */ }
    const { error } = await supabase.from(T.REFILL_REQUESTS)
        .update({ status, doctor_note: response.doctorNote || null })
        .eq('id', refillId);
    if (error) throw error;
    // An approved refill runs across the patient's prescription: the next
    // available date is carried onto the underlying prescription.
    if (status === 'approved' && req && req.prescription_id && req.next_available_date) {
        try {
            await supabase.from(T.PRESCRIPTIONS)
                .update({ next_available_date: req.next_available_date })
                .eq('id', req.prescription_id);
        } catch (e) { /* best-effort */ }
    }
    return { id: refillId, status, doctorNote: response.doctorNote || null };
}

export async function getMyRefillRequests() {
    const user = requireUser();
    let profile = null;
    try { profile = await getUserProfile(user.uid); } catch (e) { /* ignore */ }
    if (profile && profile.role === 'patient') return resolveDoctorSpecializations(await backfillRefillPrescData(await patientScopeSelect(T.REFILL_REQUESTS)));
    return resolveDoctorSpecializations(await backfillRefillPrescData(await selectEq(T.REFILL_REQUESTS, 'patient_id', user.uid)));
}

export async function getMyInsuranceVerifications() {
    const user = requireUser();
    const { data } = await supabase.from('insurance_verifications').select('*');
    if (data && data.length) return data.map(v => ({ ...v, patientName: v.patient_name, patientSurname: v.patient_surname, idPassport: v.patient_id_passport, medicalAidNumber: v.medical_aid_number, paymentStatus: v.payment_status, verifiedByEmail: v.verified_by_email }));
    return [];
}

export async function buildInsurancePdf(v) {
    await ensureJsPdf();
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    pdfHeader(doc, 'INSURANCE VERIFICATION', v.institute || 'Namibia Health Services');
    let y = 40;
    y = pdfField(doc, y, 'Patient', `${v.patientName || ''} ${v.patientSurname || ''}`.trim());
    y = pdfField(doc, y, 'ID/Passport', v.idPassport);
    y = pdfField(doc, y, 'Medical Aid No.', v.medicalAidNumber);
    y = pdfField(doc, y, 'Verification Date', v.date);
    y = pdfField(doc, y, 'Payment Status', v.paymentStatus);
    y = pdfField(doc, y, 'Status', v.status);
    y += 4;
    pdfRule(doc, y);
    pdfGridTable(doc, y + 2, [
        { label: 'Payment Status', width: 91, key: 'paymentStatus' },
        { label: 'Verification Status', width: 91, key: 'status' }
    ], [{ paymentStatus: v.paymentStatus, status: v.status }]);
    if (v.notes) {
        pdfGridTable(doc, y + 20, [{ label: 'Notes', width: 182, key: 'text' }], [{ text: v.notes }]);
    }
    pdfFooter(doc, 'Generated by Namibia Health Services - insurance verification document');
    return doc.output('blob');
}

// Payment receipt (same look as the invoice)
export async function buildPaymentReceiptPdf(pay) {
    await ensureJsPdf();
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    pdfHeader(doc, 'PAYMENT RECEIPT', 'Namibia Health Services');
    let y = 40;
    y = pdfField(doc, y, 'Patient', `${pay.patientName || ''} ${pay.patientSurname || ''}`.trim());
    y = pdfField(doc, y, 'ID/Passport', pay.idPassport);
    y = pdfField(doc, y, 'Date', pay.date);
    y = pdfField(doc, y, 'Reference', pay.reference || pay.idPassport);
    y += 4;
    pdfRule(doc, y);
    y = pdfGridTable(doc, y + 2, [
        { label: 'Description', width: 120, key: 'desc' },
        { label: 'Amount (NAD)', width: 62, key: 'amount', align: 'right' }
    ], [{ desc: pay.method ? `Payment (${pay.method})` : 'Payment received', amount: Number(pay.amount || 0).toFixed(2) }]);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(13);
    doc.text('Total', 150, y + 10);
    doc.text(`NAD ${Number(pay.amount || 0).toFixed(2)}`, 194, y + 10, { align: 'right' });
    doc.setFontSize(10); doc.setFont('helvetica', 'normal');
    doc.text('Payment received. Thank you.', 14, y + 22);
    pdfFooter(doc, 'Generated by Namibia Health Services - payment receipt');
    return doc.output('blob');
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

// Deleting anything requires the DELETING user's own password. Shows a
// self-contained confirmation dialog (works on every page) and verifies the
// password by re-authenticating as the current user. Resolves true only when
// the correct password was entered.
export function confirmDeletion(label) {
    return new Promise((resolve) => {
        let settled = false;
        const done = (v) => {
            if (settled) return;
            settled = true;
            overlay.remove();
            resolve(v);
        };
        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed; inset:0; background:rgba(0,0,0,.55); display:flex; align-items:center; justify-content:center; z-index:100000;';
        const card = document.createElement('div');
        card.style.cssText = 'background:#fff; border-radius:12px; width:92%; max-width:420px; box-shadow:0 10px 40px rgba(0,0,0,.3); overflow:hidden; font-family:Lato, sans-serif;';
        card.innerHTML =
            '<div style="background:linear-gradient(135deg,#0066cc 0%,#004499 100%); color:#fff; padding:16px 20px;">' +
                '<h3 style="margin:0; font-size:16px; font-weight:700;">Confirm deletion</h3>' +
            '</div>' +
            '<div style="padding:20px;">' +
                '<p id="cdMsg" style="margin:0 0 6px; color:#1a1a1a; font-size:14px;">' + String(label || 'This item') + ' will be deleted from ALL dashboards. This cannot be undone.</p>' +
                '<p style="margin:0 0 12px; color:#c62828; font-size:13px; font-weight:600;">Enter your password to confirm.</p>' +
                '<input type="password" id="cdPass" placeholder="Your password" autocomplete="off" style="width:100%; box-sizing:border-box; padding:10px 12px; border:2px solid #e0e0e0; border-radius:8px; font-size:15px; font-family:inherit;">' +
                '<p id="cdErr" style="color:#c62828; font-size:13px; margin:8px 0 0; min-height:16px;"></p>' +
            '</div>' +
            '<div style="display:flex; justify-content:flex-end; gap:10px; padding:0 20px 18px;">' +
                '<button id="cdCancel" style="padding:10px 18px; border:1px solid #ddd; background:#f5f5f5; color:#333; border-radius:8px; font-family:inherit; font-size:14px; font-weight:600; cursor:pointer;">Cancel</button>' +
                '<button id="cdOk" style="padding:10px 18px; border:none; background:#c62828; color:#fff; border-radius:8px; font-family:inherit; font-size:14px; font-weight:600; cursor:pointer;">Delete</button>' +
            '</div>';
        overlay.appendChild(card);
        document.body.appendChild(overlay);
        const pass = card.querySelector('#cdPass');
        const err = card.querySelector('#cdErr');
        pass.focus();
        const submit = async () => {
            const pwd = pass.value;
            if (!pwd) { err.textContent = 'Please enter your password.'; return; }
            err.textContent = 'Checking...';
            card.querySelector('#cdOk').disabled = true;
            try {
                const { data } = await supabase.auth.getUser();
                const email = data && data.user ? data.user.email : null;
                if (!email) { done(false); return; }
                const r = await supabase.auth.signInWithPassword({ email, password: pwd });
                if (r.error) {
                    err.textContent = 'Wrong password - please try again.';
                    pass.value = '';
                    pass.focus();
                    card.querySelector('#cdOk').disabled = false;
                    return;
                }
                done(true);
            } catch (e) {
                err.textContent = 'Could not verify - please try again.';
                card.querySelector('#cdOk').disabled = false;
            }
        };
        card.querySelector('#cdOk').addEventListener('click', submit);
        pass.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
        card.querySelector('#cdCancel').addEventListener('click', () => done(false));
        overlay.addEventListener('click', (e) => { if (e.target === overlay) done(false); });
    });
}

export function isValidNamibianId(id) {
    const v = String(id || '').replace(/[\s-]/g, '').toUpperCase();
    if (!v) return false;
    if (/^\d{11}$/.test(v)) return true;        // Namibian national ID (11 digits)
    if (/^[A-Z]\d{7}$/.test(v)) return true;     // Namibian passport (letter + 7 digits, e.g. A1234567)
    if (/^[A-Z0-9]{6,12}$/.test(v)) return true;  // other standard passport formats
    return false;
}

let inactivityTimeout = null;
const DEFAULT_INACTIVITY_MS = 60 * 60 * 1000;

export function initInactivityTimer(timeoutMs = DEFAULT_INACTIVITY_MS, onTimeout = () => signOut()) {
    const events = ['load', 'mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
    let lastActivityAt = Date.now();
    function resetTimer(markActivity = true) {
        if (markActivity) lastActivityAt = Date.now();
        clearTimeout(inactivityTimeout);
        inactivityTimeout = setTimeout(onTimeout, timeoutMs);
    }
    const onEvent = () => resetTimer(true);
    // Mobile browsers pause (throttle) timers while the screen is locked or the
    // app is backgrounded, so the setTimeout alone may never fire. When the page
    // becomes visible again, check how long it has been inactive and lock out
    // immediately if the limit has been exceeded.
    const onVisibility = () => {
        if (document.visibilityState === 'visible') {
            if (Date.now() - lastActivityAt > timeoutMs) {
                clearTimeout(inactivityTimeout);
                onTimeout();
            } else {
                resetTimer(false);
            }
        }
    };
    events.forEach(event => window.addEventListener(event, onEvent, { passive: true }));
    document.addEventListener('visibilitychange', onVisibility);
    resetTimer(false);
    return () => {
        clearTimeout(inactivityTimeout);
        events.forEach(event => window.removeEventListener(event, onEvent));
        document.removeEventListener('visibilitychange', onVisibility);
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
    // The dashboards' tables read camelCase fields (patientName, patientDob,
    // doctorSpecialist, ...) but the DB rows are snake_case - expose both.
    await backfillPatientDetails(data || []);
    const rows0 = (data || []).map(a => ({
        ...a,
        patientId: a.patient_id,
        patientUserId: a.patient_user_id,
        patientName: a.patient_name,
        patientSurname: a.patient_surname,
        patientDob: a.patient_dob,
        patientIdPassport: a.patient_id_passport,
        doctorSpecialist: a.doctor_specialist,
        doctorName: a.doctor_specialist,
        createdBy: a.created_by,
        createdByEmail: a.created_by_email,
        attendanceConfirmed: a.attendance_confirmed,
        confirmedByEmail: a.confirmed_by_email,
        confirmedAt: a.confirmed_at
    }));
    // Institute scoping for staff (enforced in the database as well once
    // nammedi-round30.sql has run): a staff member sees the appointments of
    // the institute they are registered to, plus appointments they created.
    // A brand-new doctor at a new institute therefore starts with an empty
    // appointments list. Patients are unaffected (they match by ID/passport).
    let out = rows0;
    try {
        const user = requireUser();
        const prof = await getUserProfile(user.uid);
        if (prof && prof.role && prof.role !== 'patient' && prof.institute) {
            const inst = String(prof.institute).trim().toLowerCase();
            out = rows0.filter(a => a.created_by === user.uid ||
                (a.institution && String(a.institution).trim().toLowerCase() === inst));
        }
    } catch (e) { out = rows0; }
    return resolveDoctorSpecializations(out);
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
    getInvoices, getPayments, markInvoicePaid, generateInvoicePdf, buildInvoicePdf, buildPrescriptionPdf, buildReportPdf, buildInsurancePdf, buildPaymentReceiptPdf, previewAndSavePdf, saveInvoicePdf, confirmDeletion, getMyPatientDocuments,
    createAppointment, getMyAppointments, getPatientAppointments, getUpcomingAppointments,
    getPrescriptionsForPatient, getPatientAilments, getPatientReports, getPatientRefills,
    getPatientInstitutes, getPatientInvoices, getPatientPayments,
    updateAppointment, deleteAppointment, rescheduleAppointment,
    confirmAppointmentAttendance, getConfirmedAppointmentsForPatient,
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
