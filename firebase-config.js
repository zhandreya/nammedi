// Firebase Configuration - INJECTED AT BUILD TIME
// Replace these values with your actual Firebase config
// In production, use GitHub Secrets and inject via workflow

const firebaseConfig = {
    apiKey: "${{ secrets.FIREBASE_API_KEY }}",
    authDomain: "${{ secrets.FIREBASE_AUTH_DOMAIN }}",
    projectId: "${{ secrets.FIREBASE_PROJECT_ID }}",
    storageBucket: "${{ secrets.FIREBASE_STORAGE_BUCKET }}",
    messagingSenderId: "${{ secrets.FIREBASE_MESSAGING_SENDER_ID }}",
    appId: "${{ secrets.FIREBASE_APP_ID }}"
};

// For local development, replace the above with your actual values:
// const firebaseConfig = {
//     apiKey: "YOUR_API_KEY",
//     authDomain: "YOUR_PROJECT.firebaseapp.com",
//     projectId: "YOUR_PROJECT_ID",
//     storageBucket: "YOUR_PROJECT.appspot.com",
//     messagingSenderId: "YOUR_SENDER_ID",
//     appId: "YOUR_APP_ID"
// };

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { firebaseConfig };
}

// Global access for non-module scripts
window.__FIREBASE_CONFIG__ = firebaseConfig;

export { firebaseConfig };