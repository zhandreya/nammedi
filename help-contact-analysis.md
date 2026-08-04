# Code Analysis: Help & Contact Page - Namibia Health Services

## Errors & Issues Found

### 1. **HTML Structure Issues**
- **Missing closing `</html>` tag** - The document ends without `</html>`
- **Script tag placement** - The `<script>` is placed after `</body>` but before `</html>` (should be inside `<body>` or `<head>`)

### 2. **CSS Issues**
- **Background image path** - `url('Desert Scope.jpeg')` assumes the image is in the same directory. If not found, it'll show a broken background.
- **Font family fallback** - `font-family: Lato, sans-serif;` - Lato may not be loaded. Consider adding a Google Fonts import or using a system font stack.

### 3. **JavaScript Issues**

#### **Critical Logic Error - Inactivity Timer**
```javascript
let inactivityTime = function () {
    let timeout;
    const resetTimer = () => {
        clearTimeout(timeout);
        timeout = setTimeout(() => {
            localStorage.removeItem('currentUserId');
            window.location.href = 'sign-up.html';
        }, 3600000); // 1 hour
    };
    window.onload = resetTimer;      // OVERWRITES previous onload!
    window.onmousemove = resetTimer; // OVERWRITES previous handlers!
    window.onkeydown = resetTimer;   // OVERWRITES previous handlers!
};
```
**Problem**: Using `window.onload =` and `window.onmousemove =` **overwrites** any existing event handlers. If other scripts (or your own `checkUserLogin`) use these, they'll be lost.

**Fix**: Use `addEventListener` instead:
```javascript
window.addEventListener('load', resetTimer);
window.addEventListener('mousemove', resetTimer);
window.addEventListener('keydown', resetTimer);
```

#### **Function Never Called**
- `checkUserLogin()` is defined but **never invoked**. The user data loading logic never runs.

#### **Missing `loadUserData()` Function**
- `loadUserData()` is called in `checkUserLogin()` but **not defined anywhere**.

#### **Inactivity Timer Not Started**
- `inactivityTime()` is called but the function only sets up event handlers - the timer only starts when events fire. Consider calling `resetTimer()` initially.

### 4. **Security & Privacy Concerns**
- **localStorage is not secure** - Data is accessible via XSS attacks, visible in DevTools, and cleared by users
- **No validation** - `currentUserId` from localStorage is trusted without verification
- **Hardcoded redirect** - `sign-up.html` assumes a specific file structure

### 5. **Accessibility Issues**
- **Missing `alt` attribute** on background image (though it's CSS background)
- **Button lacks accessible name** - `<button id="backBtn">Back</button>` is okay but could use `aria-label`
- **Color contrast** - `#0066cc` on rgba background may not meet WCAG AA

### 6. **Broken Links**
- Privacy Policy.html and Terms of Service.html - ensure these files exist
- Ministry website URL has extra brackets in href: `href="[https://www.mhss.gov.na/](https://www.mhss.gov.na/)"`

---

## Permanent User Data Storage Solutions

Since this is a static HTML page, here are options from simplest to most robust:

### Option A: Enhanced localStorage (Client-side only)
- Pros: No backend needed, works offline
- Cons: Not truly "permanent" (user can clear, device-specific, 5-10MB limit)

### Option B: Firebase/Firestore (Recommended for static sites)
- Pros: Real backend, free tier generous, real-time sync, auth built-in
- Cons: Requires Firebase project setup

### Option C: Supabase (PostgreSQL backend)
- Pros: SQL database, free tier, auth built-in
- Cons: Requires project setup

### Option D: Custom Backend API
- Pros: Full control
- Cons: Requires server hosting/maintenance

---

## Recommended: Firebase Implementation

See `firebase-user-storage.js` for a complete implementation.