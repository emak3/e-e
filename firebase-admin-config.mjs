import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import log from './logger.mjs';

// __dirnameの代替
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// サービスアカウントキーファイルのパス（JSONファイル）
// Firebaseコンソール > プロジェクト設定 > サービスアカウント > Firebase Admin SDK > 新しい秘密鍵の生成
const SERVICE_ACCOUNT_PATH = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || path.join(__dirname, './serviceAccountKey.json');

// Firebase Adminの初期化
let adminApp;
let adminDb;

try {
    const serviceAccount = JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_PATH, 'utf8'));
    
    adminApp = initializeApp({
        credential: cert(serviceAccount)
    }, 'admin');
    
    adminDb = getFirestore(adminApp);
    log.info('Firebase Admin SDKが初期化されました');
} catch (error) {
    log.error('Firebase Admin SDK初期化エラー:', error);
    throw error;
}

export { adminDb };