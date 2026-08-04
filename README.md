# Namibia Health Services - Help & Contact Page

## Summary of Fixes

### ✅ HTML Structure Errors Fixed
| Issue | Fix |
|-------|-----|
| Missing `</html>` closing tag | Added at end of document |
| `<script>` outside `<body>` | Moved inside `<body>` before `</body>` |
| Invalid URL in href | Fixed `href="[https://...](https://...)"` → `href="https://..."` |
| Missing font import | Added Google Fonts link for Lato |
| Missing `rel="noopener noreferrer"` on external links | Added for security |

### ✅ CSS Issues Fixed
| Issue | Fix |
|-------|-----|
| `font-family: Lato` without fallback | Added system font stack fallback |
| Background image path assumption | Added `background-attachment: fixed` |
| Low contrast colors | Improved contrast ratios (WCAG AA) |
| No focus styles on interactive elements | Added visible focus indicators |
| Fixed positioning without z-index | Added `z-index: 100` to back button |

### ✅ JavaScript Errors Fixed

#### **Critical Bug: Event Handler Overwriting**
```javascript
// BROKEN - Overwrites any existing handlers
window.onload = resetTimer;
window.onmousemove = resetTimer;
window.onkeydown = resetTimer;

// FIXED - Uses addEventListener (doesn't overwrite)
['load', 'mousemove', 'keydown', 'click', 'scroll', 'touchstart']
  .forEach(event => window.addEventListener(event, resetTimer, { passive: true }));
```

#### **Critical Bug: `checkUserLogin()` Never Called**
```javascript
// BROKEN - Function defined but never invoked
function checkUserLogin() { ... }

// FIXED - Using Firebase Auth state observer
onAuthStateChanged(auth, (user) => {
    if (user) loadUserProfile(user);
    else redirectToSignIn();
});
```

#### **Critical Bug: `loadUserData()` Not Defined**
```javascript
// BROKEN - Called but doesn't exist
loadUserData();

// FIXED - Implemented as loadUserProfile() with Firestore
async function loadUserProfile(uid) { ... }
```

#### **Inactivity Timer Never Starts**
```javascript
// BROKEN - Timer only starts on first event
inactivityTime();

// FIXED - Initialize immediately
resetInactivityTimer();
```

### ✅ Security Improvements
| Issue | Fix |
|-------|-----|
| localStorage only (client-side, insecure) | **Firebase Firestore** - server-side database |
| No authentication | **Firebase Auth** - email/password with secure tokens |
| No password validation | Minimum 6 chars, email format validation |
| XSS vulnerable localStorage | Server-validated tokens, HTTPS-only |
| No session management | 1-hour inactivity timeout with auto-signout |

---

## 🔥 Firebase Setup Instructions

### 1. Create Firebase Project
1. Go to [Firebase Console](https://console.firebase.google.com)
2. Click "Create a project" → Name it (e.g., "namibia-health-services")
3. Enable Google Analytics (optional)

### 2. Enable Authentication
1. In Firebase Console → **Authentication** → **Sign-in method**
2. Enable **Email/Password**
3. Save

### 3. Create Firestore Database
1. Go to **Firestore Database** → **Create database**
2. Choose **Start in test mode** (for development)
3. Select location (closest to Namibia: `europe-west1` or `us-central1`)

### 4. Get Your Config
1. Project Settings (gear icon) → **General** → **Your apps**
2. Click **</>** (Web app) → Register app
3. Copy the `firebaseConfig` object

### 5. Update Config in Code
Replace the placeholder in **both files**:

```javascript
// In firebase-user-storage.js AND help-contact-fixed.html
const firebaseConfig = {
    apiKey: "YOUR_ACTUAL_API_KEY",
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT_ID.appspot.com",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID"
};
```

### 6. Set Firestore Security Rules
Go to **Firestore Database** → **Rules** and replace with:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can only read/write their own profile
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

Click **Publish**.

---

## 📁 File Structure

```
project-folder/
├── help-contact-fixed.html      # Main page (FIXED + Firebase)
├── sign-up.html                 # Registration page
├── login.html                   # Login page
├── firebase-user-storage.js     # Reusable Firebase module
├── firebase-config.js           # Your Firebase config (create this)
├── Privacy Policy.html          # Your existing file
├── Terms of Service.html        # Your existing file
├── Desert Scope.jpeg            # Your background image
└── README.md                    # This file
```

---

## 🚀 How It Works

### User Flow
```
┌─────────────┐     ┌─────────────┐     ┌─────────────────┐
│  sign-up.html │────▶│  Firebase   │────▶│ help-contact-   │
│  (Register)  │     │  Auth +     │     │ fixed.html      │
└─────────────┘     │  Firestore  │     │ (Protected)     │
                    └─────────────┘     └─────────────────┘
                           ▲                    │
                           │                    ▼
                    ┌─────────────┐     ┌─────────────────┐
                    │  login.html │◀────│  Auto sign-out  │
                    │  (Sign In)  │     │  after 1 hour   │
                    └─────────────┘     └─────────────────┘
```

### Data Stored in Firestore
```javascript
// Collection: users
// Document ID: user.uid (from Firebase Auth)
{
  uid: "abc123...",
  email: "user@example.com",
  displayName: "John",
  fullName: "John Doe",
  phone: "061 123 4567",
  dateOfBirth: "",
  address: "",
  emergencyContact: { name: "", phone: "", relationship: "" },
  medicalInfo: { 
    bloodType: "", 
    allergies: [], 
    conditions: [], 
    medications: [] 
  },
  createdAt: Timestamp,
  updatedAt: Timestamp,
  lastLoginAt: Timestamp
}
```

---

## 🔧 API Reference (firebase-user-storage.js)

### Authentication
```javascript
import { signUp, signIn, signOut, resetPassword, onAuthChange } from './firebase-user-storage.js';

// Register new user
await signUp('email@example.com', 'password123', {
    fullName: 'John Doe',
    phone: '061 123 4567'
});

// Sign in existing user
await signIn('email@example.com', 'password123');

// Sign out
await signOut();

// Listen for auth changes
const unsubscribe = onAuthChange((user) => {
    if (user) console.log('Logged in:', user.uid);
    else console.log('Logged out');
});
```

### User Profile
```javascript
import { getUserProfile, updateUserProfile, updateMedicalInfo, updateEmergencyContact } from './firebase-user-storage.js';

// Get profile
const profile = await getUserProfile(uid);

// Update profile
await updateUserProfile(uid, { fullName: 'Jane Doe', phone: '081 234 5678' });

// Update medical info
await updateMedicalInfo(uid, {
    bloodType: 'O+',
    allergies: ['Penicillin'],
    conditions: ['Hypertension'],
    medications: ['Lisinopril']
});

// Update emergency contact
await updateEmergencyContact(uid, {
    name: 'Jane Doe',
    phone: '081 234 5678',
    relationship: 'Spouse'
});
```

### Utilities
```javascript
import { formatTimestamp, isValidEmail, isValidNamibianPhone, initInactivityTimer } from './firebase-user-storage.js';

formatTimestamp(firestoreTimestamp); // "Jul 16, 2026, 10:30"
isValidEmail('test@example.com');    // true/false
isValidNamibianPhone('061 123 4567'); // true/false

// Auto sign-out after inactivity
const cleanup = initInactivityTimer(60 * 60 * 1000, () => signOut());
```

---

## 🎨 Customization

### Change Inactivity Timeout
```javascript
// In help-contact-fixed.html
initInactivityTimer(30 * 60 * 1000); // 30 minutes instead of 1 hour
```

### Add More Profile Fields
1. Update `createUserProfile()` in `firebase-user-storage.js`
2. Add fields to Firestore security rules if needed
3. Update `loadUserProfile()` in HTML to display new fields

### Styling
All CSS is in `<style>` tags in each HTML file. Colors use CSS custom properties for easy theming:
- Primary: `#0066cc`
- Success: `#4CAF50`
- Error: `#f44336`

---

## 🔒 Security Checklist

- [ ] Replace Firebase config with your actual values
- [ ] Set Firestore rules to user-only access (provided above)
- [ ] Enable **App Check** in Firebase Console for production
- [ ] Set up **Authorized domains** in Authentication settings
- [ ] Use HTTPS in production (Firebase Hosting provides this free)
- [ ] Consider enabling **Email Enumeration Protection** in Auth settings

---

## 🐛 Troubleshooting

| Issue | Solution |
|-------|----------|
| "Firebase not initialized" | Check config object has all required fields |
| "Permission denied" | Verify Firestore rules match your project ID |
| "Auth domain not authorized" | Add your domain to Auth → Settings → Authorized domains |
| Module import errors | Serve via HTTP server (not `file://`), e.g., `npx serve` |
| Background image not showing | Ensure `Desert Scope.jpeg` is in same folder |

---

## 📞 Support

For issues with this implementation:
1. Check browser console for errors
2. Verify Firebase config matches your project
3. Check Firestore rules are published
4. Ensure you're serving via HTTP(S), not file://

---

*Built for Namibia Health Services | Last updated: 2026-07-16*