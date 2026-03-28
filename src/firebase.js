import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBZIQun9d3XLATf5xMTYpB77Urf1WOOsqY",
  authDomain: "shuttle-ranked.firebaseapp.com",
  projectId: "shuttle-ranked",
  storageBucket: "shuttle-ranked.firebasestorage.app",
  messagingSenderId: "437517404919",
  appId: "1:437517404919:web:5f94d764b479debbaee1f2"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const provider = new GoogleAuthProvider();
export const db = getFirestore(app);