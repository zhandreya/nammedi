/**
 * Firebase User Storage Module
 * 
 * Provides persistent user data storage using Firebase Firestore.
 * Include this script in any page that needs user data persistence.
 * 
 * Setup:
 * 1. Create a Firebase project at https://console.firebase.google.com
 * 2. Enable Authentication (Email/Password) and Firestore Database
 * 3. Copy your config and replace the firebaseConfig object below
 * 4. Add this script to your HTML pages as <script type="module">
 */

// ============================================================================
// FIREBASE CONFIGURATION - REPLACE WITH YOUR CONFIG
// ============================================================================
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT_ID.appspot.com",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID"
};

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
    sendPasswordResetEmail
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { 
    getFirestore, 
    doc, 
    getDoc, 
    setDoc, 
    updateDoc, 
    serverTimestamp,
    collection,
    query,
    where,
    getDocs
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// ============================================================================
// USER DATA MODEL
// ============================================================================
/**
 * User document structure in Firestore:
 * users/{uid} {
 *   uid: string,
 *   email: string,
 *   displayName: string,
 *   fullName: string,
 *   phone: string,
 *   dateOfBirth: string, // ISO date string
 *   address: string,
 *   emergencyContact: {
 *     name: string,
 *     phone: string,
 *     relationship: string
 *   },
 *   medicalInfo: {
 *     bloodType: string,
 *     allergies: string[],
 *     conditions: string[],
 *     medications: string[]
 *   },
 *   createdAt: Timestamp,
 *   updatedAt: Timestamp,
 *   lastLoginAt: Timestamp
 * }
// ============================================================================

// ============================================================================
// AUTHENTICATION FUNCTIONS
// ============================================================================

/**
 * Sign up a new user with email and password
 * @param {string} email 
 * @param {string} password 
 * @param {Object} additionalData - Optional: displayName, fullName, phone
 * @returns {Promise<UserCredential>}
 */
export async function signUp(email, password, additionalData = {}) {
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // Update auth profile
        if (additionalData.displayName) {
            await updateProfile(user, { displayName: additionalData.displayName });
        }

        // Create user document in Firestore
        await createUserProfile(user.uid, {
            email,
            ...additionalData,
            createdAt: serverTimestamp()
        });

        return userCredential;
    } catch (error) {
        throw new Error(getAuthErrorMessage(error.code));
    }
}

/**
 * Sign in existing user
 * @param {string} email 
 * @param {string} password 
 * @returns {Promise<UserCredential>}
 */
export async function signIn(email, password) {
    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        
        // Update last login timestamp
        await updateLastLogin(userCredential.user.uid);
        
        return userCredential;
    } catch (error) {
        throw new Error(getAuthErrorMessage(error.code));
    }
}

/**
 * Sign out current user
 * @returns {Promise<void>}
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
 * @param {string} email 
 * @returns {Promise<void>}
 */
export async function resetPassword(email) {
    try {
        await sendPasswordResetEmail(auth, email);
    } catch (error) {
        throw new Error(getAuthErrorMessage(error.code));
    }
}

/**
 * Get current authenticated user
 * @returns {User|null}
 */
export function getCurrentUser() {
    return auth.currentUser;
}

/**
 * Subscribe to auth state changes
 * @param {Function} callback - Called with (user) when auth state changes
 * @returns {Function} Unsubscribe function
 */
export function onAuthChange(callback) {
    return onAuthStateChanged(auth, callback);
}

// ============================================================================
// USER PROFILE FUNCTIONS
// ============================================================================

/**
 * Create initial user profile in Firestore
 * @param {string} uid 
 * @param {Object} data 
 * @returns {Promise<void>}
 */
export async function createUserProfile(uid, data) {
    const userRef = doc(db, 'users', uid);
    const profileData = {
        uid,
        email: data.email || '',
        displayName: data.displayName || data.fullName || '',
        fullName: data.fullName || '',
        phone: data.phone || '',
        dateOfBirth: data.dateOfBirth || '',
        address: data.address || '',
        emergencyContact: data.emergencyContact || {
            name: '',
            phone: '',
            relationship: ''
        },
        medicalInfo: data.medicalInfo || {
            bloodType: '',
            allergies: [],
            conditions: [],
            medications: []
        },
        createdAt: data.createdAt || serverTimestamp(),
        updatedAt: serverTimestamp(),
        lastLoginAt: serverTimestamp()
    };

    await setDoc(userRef, profileData);
}

/**
 * Get user profile from Firestore
 * @param {string} uid 
 * @returns {Promise<Object|null>}
 */
export async function getUserProfile(uid) {
    const userRef = doc(db, 'users', uid);
    const userSnap = await getDoc(userRef);
    
    if (userSnap.exists()) {
        return { id: userSnap.id, ...userSnap.data() };
    }
    return null;
}

/**
 * Update user profile
 * @param {string} uid 
 * @param {Object} data 
 * @returns {Promise<void>}
 */
export async function updateUserProfile(uid, data) {
    const userRef = doc(db, 'users', uid);
    await updateDoc(userRef, {
        ...data,
        updatedAt: serverTimestamp()
    });
}

/**
 * Update last login timestamp
 * @param {string} uid 
 * @returns {Promise<void>}
 */
export async function updateLastLogin(uid) {
    const userRef = doc(db, 'users', uid);
    await updateDoc(userRef, {
        lastLoginAt: serverTimestamp()
    });
}

/**
 * Update medical information
 * @param {string} uid 
 * @param {Object} medicalInfo 
 * @returns {Promise<void>}
 */
export async function updateMedicalInfo(uid, medicalInfo) {
    const userRef = doc(db, 'users', uid);
    await updateDoc(userRef, {
        medicalInfo: {
            bloodType: medicalInfo.bloodType || '',
            allergies: medicalInfo.allergies || [],
            conditions: medicalInfo.conditions || [],
            medications: medicalInfo.medications || []
        },
        updatedAt: serverTimestamp()
    });
}

/**
 * Update emergency contact
 * @param {string} uid 
 * @param {Object} contact 
 * @returns {Promise<void>}
 */
export async function updateEmergencyContact(uid, contact) {
    const userRef = doc(db, 'users', uid);
    await updateDoc(userRef, {
        emergencyContact: {
            name: contact.name || '',
            phone: contact.phone || '',
            relationship: contact.relationship || ''
        },
        updatedAt: serverTimestamp()
    });
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Convert Firestore Timestamp to readable string
 * @param {Timestamp|Date|string} timestamp 
 * @returns {string}
 */
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

/**
 * Convert auth error codes to user-friendly messages
 * @param {string} code 
 * @returns {string}
 */
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
        'auth/invalid-credential': 'Invalid credentials provided.'
    };
    return messages[code] || 'An error occurred. Please try again.';
}

/**
 * Validate email format
 * @param {string} email 
 * @returns {boolean}
 */
export function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Validate phone number (Namibia format)
 * @param {string} phone 
 * @returns {boolean}
 */
export function isValidNamibianPhone(phone) {
    // Supports formats: 0611234567, +264611234567, 0811234567
    return /^(\+264|0)[6-8][0-9]{7}$/.test(phone.replace(/\s/g, ''));
}

// ============================================================================
// INACTIVITY TIMEOUT MANAGER
// ============================================================================

let inactivityTimeout = null;
const DEFAULT_INACTIVITY_MS = 60 * 60 * 1000; // 1 hour

/**
 * Initialize inactivity timer
 * @param {number} timeoutMs - Timeout in milliseconds (default: 1 hour)
 * @param {Function} onTimeout - Callback when timeout occurs
 */
export function initInactivityTimer(timeoutMs = DEFAULT_INACTIVITY_MS, onTimeout = () => signOut()) {
    const events = ['load', 'mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
    
    function resetTimer() {
        clearTimeout(inactivityTimeout);
        inactivityTimeout = setTimeout(onTimeout, timeoutMs);
    }

    events.forEach(event => {
        window.addEventListener(event, resetTimer, { passive: true });
    });

    // Initial start
    resetTimer();

    // Return cleanup function
    return () => {
        clearTimeout(inactivityTimeout);
        events.forEach(event => {
            window.removeEventListener(event, resetTimer);
        });
    };
}

// ============================================================================
// EXPORT ALL
// ============================================================================
export default {
    auth,
    db,
    signUp,
    signIn,
    signOut,
    resetPassword,
    getCurrentUser,
    onAuthChange,
    createUserProfile,
    getUserProfile,
    updateUserProfile,
    updateLastLogin,
    updateMedicalInfo,
    updateEmergencyContact,
    formatTimestamp,
    isValidEmail,
    isValidNamibianPhone,
    initInactivityTimer
};