// Firebase Configuration for DotStudio® POS
const firebaseConfig = {
  apiKey: "AIzaSyBDaZzhcpYKG8zxvueDEoCNtX_3Iu0auq4",
  authDomain: "dotstudio-pos.firebaseapp.com",
  projectId: "dotstudio-pos",
  storageBucket: "dotstudio-pos.firebasestorage.app",
  messagingSenderId: "914496008862",
  appId: "1:914496008862:web:11466fe7fa020b519a418f",
  measurementId: "G-02MJ4LDFYP"
};

// Expose for firebase-bridge.js and other modules
window.firebaseConfig = firebaseConfig;

// Firebase v10 Modular SDK is initialized in index.html via CDN module script.
// On other pages, firebase-bridge.js lazy-loads it on demand.