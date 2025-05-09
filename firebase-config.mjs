import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import log from './logger.mjs';

// Firebase設定
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID
};

// Firebaseの初期化
let app;
let db;

try {
  app = initializeApp(firebaseConfig);
  db = getFirestore(app);
  log.info('Firebase Firestoreに接続しました');
} catch (error) {
  log.error('Firebase接続エラー:', error);
}

// 現在時刻を取得する関数（代替手段）
function getCurrentTimestamp() {
  return new Date().toISOString();
}

export { db, getCurrentTimestamp };