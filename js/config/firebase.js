import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';
import { getFunctions } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-functions.js';

const firebaseConfig = {
  apiKey: 'AIzaSyDmpeBPs7AEhUr_I8KU1boRXVQKsMKnhVQ',
  authDomain: 'sinaldesk-hml.firebaseapp.com',
  projectId: 'sinaldesk-hml',
  storageBucket: 'sinaldesk-hml.firebasestorage.app',
  messagingSenderId: '338438459376',
  appId: '1:338438459376:web:f30d427998aadeb6659735',
  measurementId: 'G-1YCX97FZK1'
};

export const firebaseApp = initializeApp(firebaseConfig);
export const auth = getAuth(firebaseApp);
export const db = getFirestore(firebaseApp);
export const functions = getFunctions(firebaseApp, 'southamerica-east1');
export const environment = Object.freeze({
  name: 'HML',
  production: false,
  firebaseProjectId: firebaseConfig.projectId
});
