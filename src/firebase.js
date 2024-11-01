import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
    apiKey: "AIzaSyCBCzVocjN39-ww7TdwMTTrDonuprSbE4s",
    authDomain: "social-login-2da5f.firebaseapp.com",
    projectId: "social-login-2da5f",
    storageBucket: "social-login-2da5f.firebasestorage.app",
    messagingSenderId: "634891082790",
    appId: "1:634891082790:web:76aa524fcb5c39f7021ae7",
    measurementId: "G-NJCZMP39Y8"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app); 