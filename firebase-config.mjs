import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import log from './logger.mjs';

// Firebase設定（Firebase Consoleのプロジェクト設定 > 全般 > アプリに追加 > Webからコピー）
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID
};

// Firebaseの初期化
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

log.info('Firebase Firestoreに接続しました');

export { db };