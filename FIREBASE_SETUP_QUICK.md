# Firebase Setup & Deployment - Quick Reference

## 🔥 One-Time Firebase Setup (15 min)

### 1. Create Project
- [ ] Go to [console.firebase.google.com](https://console.firebase.google.com)
- [ ] "Create a project" → `namibia-health-services`
- [ ] Enable Google Analytics (optional)

### 2. Enable Services
- [ ] **Authentication** → Sign-in method → **Email/Password** → Enable
- [ ] **Firestore Database** → Create database → Test mode → `europe-west1`
- [ ] **Storage** → Get started → Test mode → Same region

### 3. Get Config
- [ ] Project Settings (⚙️) → General → Your apps → Web (</>) → Register
- [ ] Copy config values

---

## 🔧 Local Development

### Option A: Direct Config (Easiest)
Edit `firebase-config.js` and replace with your values:
```javascript
const firebaseConfig = {
    apiKey: "AIza...",
    authDomain: "your-project.firebaseapp.com",
    projectId: "your-project",
    storageBucket: "your-project.appspot.com",
    messagingSenderId: "123...",
    appId: "1:123..."
};
```

### Option B: Environment Variables (Production)
```bash
# Add to .env.local (gitignored)
FIREBASE_API_KEY=AIza...
FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
FIREBASE_PROJECT_ID=your-project
FIREBASE_STORAGE_BUCKET=your-project.appspot.com
FIREBASE_MESSAGING_SENDER_ID=123...
FIREBASE_APP_ID=1:123...
```

### Run Locally
```bash
# Python (built-in)
python3 -m http.server 8000
# Open http://localhost:8000

# Or Node.js
npx serve .
# Open shown URL
```

---

## 🚀 Deploy to GitHub Pages (Free)

### 1. Push to GitHub
```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOURUSER/namibia-health-services.git
git push -u origin main
```

### 2. Enable GitHub Pages
- [ ] GitHub repo → Settings → Pages
- [ ] Source: "GitHub Actions"
- [ ] Save

### 3. Add Secrets
- [ ] Settings → Secrets and variables → Actions → New repository secret
- [ ] Add each:
  - `FIREBASE_API_KEY`
  - `FIREBASE_AUTH_DOMAIN`
  - `FIREBASE_PROJECT_ID`
  - `FIREBASE_STORAGE_BUCKET`
  - `FIREBASE_MESSAGING_SENDER_ID`
  - `FIREBASE_APP_ID`

### 4. Deploy
- [ ] Actions tab → "Deploy to GitHub Pages" → Run workflow
- [ ] Wait for completion → Site at `https://YOURUSER.github.io/REPO/`

---

## 🔐 Firestore Rules (Deploy Once)

### Via Console
1. Firestore Database → Rules
2. Copy entire `firestore.rules` content
3. Publish

### Via CLI
```bash
npm install -g firebase-tools
firebase login
firebase init firestore  # Select project, rules file: firestore.rules
firebase deploy --only firestore:rules
```

---

## ✅ Test Checklist

| Feature | Test |
|---------|------|
| Patient signup/login | ☐ |
| Medical staff signup/login | ☐ |
| Receptionist signup/login | ☐ |
| Specialist signup/login | ☐ |
| Patient dashboard | ☐ |
| Staff dashboard | ☐ |
| Create patient | ☐ |
| Schedule appointment | ☐ |
| Upload document | ☐ |
| Cross-institute access | ☐ |
| Patient assignment | ☐ |
| Offline behavior | ☐ |

---

## 🛠 Troubleshooting

| Issue | Fix |
|-------|-----|
| "Firebase not initialized" | Check `firebase-config.js` has real values |
| "Permission denied" | Deploy `firestore.rules` |
| "Auth domain not authorized" | Add domain to Auth → Settings → Authorized domains |
| Config not injecting | Check GitHub Secrets names match exactly |
| Build fails | Check Actions tab for error logs |

---

## 📁 Key Files

| File | Purpose |
|------|---------|
| `firebase-config.js` | **Edit with your Firebase config** |
| `firebase-health-services.js` | Main backend module (imports config) |
| `firestore.rules` | Security rules |
| `.github/workflows/deploy.yml` | Auto-deploy to GitHub Pages |
| `DEPLOY.md` | Detailed deployment guide |
| `PATIENT_ASSIGNMENT_SYSTEM.md` | Cross-user access docs |

---

## 📞 Need Help?

- **Firebase Console**: [console.firebase.google.com](https://console.firebase.google.com)
- **GitHub Actions**: Your repo → Actions tab
- **Firebase Docs**: [firebase.google.com/docs](https://firebase.google.com/docs)
- **GitHub Pages Docs**: [docs.github.com/pages](https://docs.github.com/pages)