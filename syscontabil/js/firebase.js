// Inicialização do Firebase (Auth + Firestore) e reexportação das funções usadas.
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js';

export {
    signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged,
} from 'https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js';

export {
    collection, doc, setDoc, getDoc, getDocs, deleteDoc, writeBatch,
} from 'https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js';

// A apiKey de um app web Firebase é pública por natureza; a segurança dos dados
// depende das Firestore Rules (veja syscontabil/README.md).
const firebaseConfig = {
    apiKey: 'AIzaSyDn_eoBdLbAKyYanNWubHGF6GK0PDTtKmY',
    authDomain: 'fap--syscont.firebaseapp.com',
    projectId: 'fap--syscont',
    storageBucket: 'fap--syscont.firebasestorage.app',
    messagingSenderId: '433456787681',
    appId: '1:433456787681:web:61ded632b1b2ea1ce7c7a0',
    measurementId: 'G-0GRW1QZK79',
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
