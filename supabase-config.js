/**
 * Supabase User Storage Module
 * Persistent user data via Supabase Auth + Postgres.
 */

import { supabaseConfig } from './supabase-config.js';
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

export const supabase = createClient(supabaseConfig.url, supabaseConfig.anonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
});

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
        'Email not confirmed': 'Please confirm your email before signing in.'
    };
    return new Error(map[msg] || msg);
}

export async function signUp(email, password, additionalData = {}) {
    try {
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: { data: { displayName: additionalData.displayName || additionalData.fullName || '' } }
        });
        if (error) throw error;
        const user = data.user;
        if (user) {
            await createUserProfile(user.id, { email, ...additionalData, createdAt: nowIso() });
        }
        return { user: mapUser(user), session: data.session };
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
}

export async function resetPassword(email) {
    const redirectTo = 'https://zhandreya.github.io/nammedi/forgot-password.html';
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
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
        uid,
        email: data.email || '',
        display_name: data.displayName || data.fullName || '',
        full_name: data.fullName || '',
        phone: data.phone || '',
        date_of_birth: data.dateOfBirth || null,
        address: data.address || '',
        emergency_contact: data.emergencyContact || { name: '', phone: '', relationship: '' },
        medical_info: data.medicalInfo || { bloodType: '', allergies: [], conditions: [], medications: [] },
        created_at: data.createdAt || nowIso(),
        updated_at: nowIso(),
        last_login_at: nowIso()
    };
    const { error } = await supabase.from('users').upsert(profileData);
    if (error) throw error;
}

export async function getUserProfile(uid) {
    const { data, error } = await supabase.from('users').select('*').eq('id', uid).maybeSingle();
    if (error) throw error;
    return data;
}

export async function updateUserProfile(uid, data) {
    const { error } = await supabase.from('users').update({ ...data, updated_at: nowIso() }).eq('id', uid);
    if (error) throw error;
}

export async function updateLastLogin(uid) {
    const { error } = await supabase.from('users').update({ last_login_at: nowIso() }).eq('id', uid);
    if (error) console.warn('updateLastLogin', error);
}

export async function updateMedicalInfo(uid, medicalInfo) {
    await updateUserProfile(uid, {
        medical_info: {
            bloodType: medicalInfo.bloodType || '',
            allergies: medicalInfo.allergies || [],
            conditions: medicalInfo.conditions || [],
            medications: medicalInfo.medications || []
        }
    });
}

export async function updateEmergencyContact(uid, contact) {
    await updateUserProfile(uid, {
        emergency_contact: {
            name: contact.name || '',
            phone: contact.phone || '',
            relationship: contact.relationship || ''
        }
    });
}

export function formatTimestamp(timestamp) {
    if (!timestamp) return 'Never';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleString('en-NA', {
        year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
}

export function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function isValidNamibianPhone(phone) {
    return /^(\+264|0)[6-8][0-9]{7}$/.test(phone.replace(/\s/g, ''));
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

export default {
    supabase, signUp, signIn, signOut, resetPassword, getCurrentUser, onAuthChange,
    createUserProfile, getUserProfile, updateUserProfile, updateLastLogin,
    updateMedicalInfo, updateEmergencyContact, formatTimestamp, isValidEmail,
    isValidNamibianPhone, initInactivityTimer
};
