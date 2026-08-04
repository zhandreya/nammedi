# 🚀 Namibia Health Services - Deployment Checklist

## Pre-Deployment Requirements

### 1. Firebase Project Setup
- [ ] Create Firebase project at [console.firebase.google.com](https://console.firebase.google.com)
- [ ] Project name: `namibia-health-services` (or your preferred name)
- [ ] Enable **Google Analytics** (optional but recommended)
- [ ] Note your **Project ID** - you'll need it for config

### 2. Enable Firebase Services
- [ ] **Authentication** → Sign-in method → **Email/Password** → Enable
- [ ] **Firestore Database** → Create database → **Start in test mode** → Choose region (e.g., `europe-west1` for Namibia)
- [ ] **Storage** → Get started → **Start in test mode** → Same region as Firestore
- [ ] **Hosting** → Get started (for web deployment)

### 3. Configure Authentication
- [ ] Authentication → Settings → **Authorized domains** → Add your domains:
  - `localhost` (for development)
  - `your-project.web.app` (Firebase hosting)
  - `your-custom-domain.com` (if using custom domain)
- [ ] Authentication → Settings → **Email template** → Customize reset password email
- [ ] (Optional) Enable **Email enumeration protection** for security

---

## 🔧 Configuration Files to Update

### 1. Update `firebase-health-services.js`
Replace the placeholder config with your actual Firebase config:

```javascript
// In firebase-health-services.js, find and replace:
const firebaseConfig = {
    apiKey: "YOUR_ACTUAL_API_KEY",
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT_ID.appspot.com",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID"
};
```

**Get these values from:** Firebase Console → Project Settings (⚙️) → General → Your apps → Web app (</>) → Config

### 2. Verify Image Assets
Ensure these images exist in your project root:
- [ ] `Desert Scope.jpeg` - Background image
- [ ] `Nam heart.jpeg` - Logo image
- [ ] `default-profile.png` - Default profile picture (create if missing)

---

## 🔐 Firestore Security Rules Deployment

### 1. Copy Rules File
The `firestore.rules` file in your project root contains comprehensive rules for:
- Role-based access (patient, medical_staff, receptionist, specialist, admin)
- Institute-based data sharing
- Patient assignment to doctors
- Cross-user access for healthcare coordination

### 2. Deploy Rules
**Option A: Firebase Console**
1. Go to Firestore Database → Rules
2. Copy entire content of `firestore.rules`
3. Paste and click **Publish**

**Option B: CLI (Recommended)**
```bash
firebase deploy --only firestore:rules
```

### 3. Test Rules
Use Firebase Console → Rules → **Rules Playground** to simulate:
- Patient reading own data
- Doctor reading assigned patient
- Receptionist reading institute patients
- Unauthorized access attempts

---

## 📦 Storage Rules (Optional but Recommended)

Create `storage.rules` in project root:

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // Profile pictures - users can upload their own
    match /profile-pictures/{userId}/{fileName} {
      allow read: if true;
      allow write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Documents - staff can upload for their patients
    match /documents/{staffId}/{patientId}/{fileName} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.uid == staffId;
    }
  }
}
```

Deploy: `firebase deploy --only storage`

---

## 🌐 Firebase Hosting Deployment

### 1. Initialize Hosting
```bash
firebase init hosting
```
- Select **Use an existing project** → your project
- **Public directory:** `.` (current directory) or `public` if you create a subfolder
- **Single-page app:** `No` (we have multiple HTML files)
- **Overwrite index.html:** `No`

### 2. Configure `firebase.json`
Ensure your `firebase.json` includes:
```json
{
  "hosting": {
    "public": ".",
    "ignore": [
      "firebase.json",
      "**/.*",
      "**/node_modules/**",
      "firestore.rules",
      "storage.rules",
      "README.md",
      "DEPLOY.md"
    ],
    "rewrites": [
      {
        "source": "**",
        "destination": "/index.html"
      }
    ],
    "headers": [
      {
        "source": "**/*.@(js|css|html)",
        "headers": [
          {
            "key": "Cache-Control",
            "value": "max-age=3600"
          }
        ]
      }
    ]
  }
}
```

### 3. Deploy
```bash
firebase deploy --only hosting
```

---

## ✅ Post-Deployment Verification

### 1. Test Authentication Flow
- [ ] Visit deployed URL → `start.html`
- [ ] Select **Patient** → Sign Up → Verify email → Sign In → Redirect to `patient-dashboard.html`
- [ ] Select **Medical Staff** → Sign Up → Sign In → Redirect to `medical-staff-dashboard.html`
- [ ] Select **Receptionist** → Sign Up → Sign In → Redirect to `receptionist-dashboard.html`
- [ ] Select **Specialist** → Sign Up → Sign In → Redirect to `specialist-dashboard.html`
- [ ] Test **Forgot Password** → `forgot-password.html`

### 2. Test Role-Based Features

#### Patient
- [ ] Dashboard shows stats
- [ ] Schedule appointment → `patient-appointments.html`
- [ ] View prescriptions → `patient-prescriptions.html`
- [ ] Request refill → `request-refill.html`
- [ ] View medical history → `patient-medical-history.html`
- [ ] View reports → `patient-reports.html`
- [ ] View institutes → `patient-institutes.html`
- [ ] View ailments → `patient-ailments.html`

#### Medical Staff
- [ ] Dashboard shows stats
- [ ] Add patient → Modal form
- [ ] Manage appointments tab
- [ ] Upload documents tab
- [ ] Record medications tab
- [ ] Tasks & reminders tab

#### Receptionist
- [ ] Dashboard shows stats
- [ ] Patient management
- [ ] Appointment management
- [ ] Insurance verification
- [ ] Billing (invoices/payments)
- [ ] Reports generation

#### Specialist
- [ ] Dashboard shows stats
- [ ] Patient management
- [ ] Appointment management
- [ ] Prescription management
- [ ] Document upload

### 3. Test Cross-User Access (Critical!)
- [ ] **Medical Staff A** creates patient → **Medical Staff B** (same institute) can read
- [ ] **Receptionist** creates patient → **Medical Staff** (same institute) can read
- [ ] **Specialist** assigned to patient → Can read/write patient data
- [ ] **Patient** can only see their own data
- [ ] **Unauthorized** access blocked (different institute)

### 4. Test Data Persistence
- [ ] Sign out → Sign in → Data persists
- [ ] Refresh page → Data loads from Firestore
- [ ] Different browser/device → Data syncs
- [ ] Offline support (if enabled) → Queue writes

### 5. Test File Uploads
- [ ] Upload profile picture
- [ ] Upload patient document (PDF, JPG, PNG)
- [ ] Download document
- [ ] Delete document

---

## 🔒 Security Hardening (Production)

### 1. Update Firestore Rules for Production
Change from test mode to production rules:
- [ ] Remove `allow read, write: if true;` 
- [ ] Ensure all rules use `request.auth != null`
- [ ] Test with Rules Playground

### 2. Configure App Check (Recommended)
- [ ] Firebase Console → App Check → Register apps
- [ ] Add **reCAPTCHA v3** for web
- [ ] Enforce for Firestore, Storage, Auth

### 3. Set Up Monitoring
- [ ] Firebase Console → **Crashlytics** (if using)
- [ ] **Performance Monitoring** → Enable
- [ ] **Analytics** → Set up conversions

### 4. Custom Domain (Optional)
- [ ] Hosting → **Add custom domain**
- [ ] Verify ownership → Update DNS
- [ ] SSL certificate auto-provisioned

---

## 📱 PWA Setup (Optional)

### 1. Create `manifest.json`
```json
{
  "name": "Namibia Health Services",
  "short_name": "NHS",
  "start_url": "/start.html",
  "display": "standalone",
  "background_color": "#0066cc",
  "theme_color": "#0066cc",
  "icons": [
    { "src": "icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "icons/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

### 2. Add to HTML head
```html
<link rel="manifest" href="/manifest.json">
<meta name="theme-color" content="#0066cc">
```

---

## 📊 Performance Optimization

### 1. Enable Compression
- [ ] Firebase Hosting auto-gzips
- [ ] Verify in DevTools → Network → Content-Encoding: gzip

### 2. Cache Static Assets
- [ ] `firebase.json` headers configured
- [ ] Long-term cache for JS/CSS/images

### 3. Code Splitting (Future)
- [ ] Consider dynamic imports for heavy modules
- [ ] Lazy-load dashboards

---

## 🧪 Testing Checklist

| Test | Status |
|------|--------|
| Sign up all 4 roles | ☐ |
| Sign in/out all roles | ☐ |
| Password reset | ☐ |
| Patient CRUD operations | ☐ |
| Appointment CRUD | ☐ |
| Document upload/download | ☐ |
| Prescription management | ☐ |
| Cross-institute access | ☐ |
| Patient assignment | ☐ |
| Role-based UI hiding | ☐ |
| Mobile responsiveness | ☐ |
| Offline behavior | ☐ |
| Error handling | ☐ |

---

## 📋 Go-Live Checklist

- [ ] All config updated with real Firebase values
- [ ] Firestore rules deployed and tested
- [ ] Storage rules deployed (if created)
- [ ] Hosting deployed successfully
- [ ] Custom domain configured (if applicable)
- [ ] App Check enabled (recommended)
- [ ] Analytics configured
- [ ] Error monitoring set up
- [ ] Backup strategy defined (Firestore export)
- [ ] Team access configured in Firebase Console
- [ ] Documentation shared with team
- [ ] Support contact information updated

---

## 🆘 Rollback Plan

If issues arise post-deployment:
```bash
# Rollback hosting to previous version
firebase hosting:clone SOURCE_SITE_ID:SOURCE_CHANNEL_ID TARGET_SITE_ID:live

# Or via console: Hosting → Release history → Rollback
```

---

## 📞 Support Contacts

| Role | Contact |
|------|---------|
| Firebase Project Owner | [Your Email] |
| Technical Lead | [Lead Email] |
| Firebase Support | [support.google.com/firebase] |
| Project Repository | [GitHub/GitLab URL] |

---

## 📝 Notes

- **Region:** Use `europe-west1` or `africa-south1` for Namibia latency
- **Backup:** Schedule daily Firestore exports to Cloud Storage
- **Costs:** Monitor Firebase usage in Console → Usage & billing
- **Updates:** Use `firebase deploy` for incremental updates

---

*Last Updated: $(date)*
*Version: 1.0.0*