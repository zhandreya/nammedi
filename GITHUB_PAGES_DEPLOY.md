# GitHub Pages Deployment for Namibia Health Services

This workflow automatically deploys the frontend to GitHub Pages on every push to main.

## 🚀 Quick Setup

### 1. Enable GitHub Pages
- Go to your repo → **Settings** → **Pages**
- **Source**: "GitHub Actions" (not "Deploy from a branch")

### 2. Add Firebase Config as Repository Secrets
Go to **Settings** → **Secrets and variables** → **Actions** → **New repository secret**

| Secret Name | Value |
|-------------|-------|
| `FIREBASE_API_KEY` | Your Firebase API key |
| `FIREBASE_AUTH_DOMAIN` | `your-project.firebaseapp.com` |
| `FIREBASE_PROJECT_ID` | Your Firebase project ID |
| `FIREBASE_STORAGE_BUCKET` | `your-project.appspot.com` |
| `FIREBASE_MESSAGING_SENDER_ID` | Your sender ID |
| `FIREBASE_APP_ID` | Your app ID |

### 3. Push to Main
```bash
git add .
git commit -m "Add GitHub Pages deployment"
git push origin main
```

### 4. Check Deployment
- Go to **Actions** tab → Watch the workflow run
- Your site will be at: `https://YOUR_USERNAME.github.io/REPO_NAME/`

## 🔧 Local Development

```bash
# Install dependencies (if any)
npm install

# Test locally
npx serve .
# or
python3 -m http.server 8000

# Visit http://localhost:8000
```

## 📝 Important Notes

1. **Base Path**: Site deploys to `https://username.github.io/repo-name/`
2. **Firebase Config**: Injected at build time from secrets
3. **Relative Paths**: All HTML/CSS/JS use relative paths (already configured)
4. **Firebase Backend**: Works unchanged - Auth/Firestore/Storage still use Firebase

## 🔐 Firebase Console Setup

Add these to **Firebase Console → Authentication → Settings → Authorized domains**:
- `localhost`
- `YOUR_USERNAME.github.io`

## 📂 File Structure
```
.github/
  workflows/
    deploy.yml          # This workflow
firebase-health-services.js  # Firebase config (updated at build)
*.html                  # All pages (relative paths)
*.js                    # JS modules
*.css                   # Styles (inline in HTML)
images/                 # Desert Scope.jpeg, Nam heart.jpeg
```

## 🔄 Manual Deploy (if needed)
```bash
# Install GitHub CLI
gh auth login
gh workflow run deploy.yml
```

## 🐛 Troubleshooting

| Issue | Fix |
|-------|-----|
| 404 on refresh | GitHub Pages doesn't support SPA routing - use hash routing or accept |
| Firebase config undefined | Check secrets are set correctly in repo settings |
| CORS errors | Add `YOUR_USERNAME.github.io` to Firebase Auth authorized domains |
| Images not loading | Ensure images are in repo and paths are relative |

## 📱 PWA Support (Optional)
Add to `index.html` head:
```html
<link rel="manifest" href="/manifest.json">
<meta name="theme-color" content="#0066cc">
```
Create `manifest.json` in root for offline support.