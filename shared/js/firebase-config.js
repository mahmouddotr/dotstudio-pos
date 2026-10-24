// Firebase Configuration for Cazenova POS
const firebaseConfig = {
  apiKey: "AIzaSyC_placeholder_replace_with_yours", 
  authDomain: "cazenova-pos.firebaseapp.com",
  projectId: "cazenova-pos",
  storageBucket: "cazenova-pos.appspot.com",
  messagingSenderId: "1234567890",
  appId: "1:1234567890:web:abcdef123456"
};

// Initialize Firebase (compatibility with standard script tags)
if (typeof firebase !== 'undefined') {
    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
        console.log("🔥 Firebase initialized successfully");
    }
} else {
    console.warn("Firebase SDK not loaded. Make sure you include the firebase scripts.");
}
