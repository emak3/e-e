import { initializeApp } from 'firebase/app';
import { getFirestore, enableIndexedDbPersistence, connectFirestoreEmulator } from 'firebase/firestore';
import log from "./logger.mjs";

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
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// 接続状態を追跡する変数
let isConnected = false;
let connectionPromise = null;

// Firestoreの接続を初期化する関数
async function initializeFirestore() {
  if (connectionPromise) {
    return connectionPromise;
  }

  connectionPromise = new Promise((resolve, reject) => {
    try {
      log.info('Firebase Firestoreへの接続を初期化中...');
      
      // オプション：オフラインサポートを有効にする
      enableIndexedDbPersistence(db)
        .then(() => {
          log.info('Firebase Firestoreのオフラインサポートが有効化されました');
          isConnected = true;
          resolve(db);
        })
        .catch((err) => {
          if (err.code === 'failed-precondition') {
            // 複数タブが開いている場合など
            log.warn('Firebase Firestoreのオフラインサポートは有効化できませんでした: 複数タブがすでに開いています');
            isConnected = true;
            resolve(db);
          } else if (err.code === 'unimplemented') {
            // ブラウザサポートがない場合
            log.warn('Firebase Firestoreのオフラインサポートはこの環境ではサポートされていません');
            isConnected = true;
            resolve(db);
          } else {
            log.error(`Firebase Firestoreの初期化エラー: ${err.message}`);
            reject(err);
          }
        });
    } catch (error) {
      log.error(`Firebase初期化エラー: ${error.message}`);
      reject(error);
    }
  });

  return connectionPromise;
}

// 現在時刻を取得する関数
function getCurrentTimestamp() {
  return new Date().toISOString();
}

// 接続確認用の関数
async function waitForConnection(timeout = 30000) {
  if (isConnected) return true;
  
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    try {
      await initializeFirestore();
      return true;
    } catch (error) {
      // 一時的な接続エラーの場合は待機
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  throw new Error(`Firestore接続タイムアウト (${timeout}ms)`);
}

// APIを全てPromise化するためのヘルパー関数
function withConnection(fn) {
  return async (...args) => {
    await waitForConnection();
    return fn(...args);
  };
}

export { db, getCurrentTimestamp, waitForConnection, withConnection, initializeFirestore };