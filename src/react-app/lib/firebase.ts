import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
    apiKey: "AIzaSyAe5y5HCp7uUZMCk60CXgWiv_S7odxE7hQ",
    authDomain: "tradcircole.firebaseapp.com",
    projectId: "tradcircole",
    storageBucket: "tradcircole.firebasestorage.app",
    messagingSenderId: "771363898466",
    appId: "1:771363898466:web:f4ea0f493781c26fbcbd3b",
    measurementId: "G-2PGZ84HP6J"
};

// Debug logging
console.log("Firebase Config Check:", {
    hasApiKey: !!firebaseConfig.apiKey,
    hasAuthDomain: !!firebaseConfig.authDomain,
    hasProjectId: !!firebaseConfig.projectId,
});

if (!firebaseConfig.apiKey) {
    console.error("Firebase API Key is missing! Check your .env file.");
}

import { FirebaseApp } from "firebase/app";
import { Auth } from "firebase/auth";
import { FirebaseStorage } from "firebase/storage";

let app: FirebaseApp;
let auth: Auth;
let googleProvider: GoogleAuthProvider;
let storage: FirebaseStorage;

try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    googleProvider = new GoogleAuthProvider();
    storage = getStorage(app);
    console.log("Firebase initialized successfully");
} catch (error) {
    console.error("Error initializing Firebase:", error);
}

export { auth, googleProvider, storage };
