import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import log from './logger.mjs';

// __dirnameの代替
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let app;
let db;
let isInitialized = false;

/**
 * Firebase Admin SDK初期化関数
 */
export async function initFirebaseAdmin() {
  if (isInitialized) return db;

  try {
    // サービスアカウントの読み込み方法（環境変数または.jsonファイル）
    let serviceAccount;
    
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      // 環境変数からJSONを解析
      serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    } else {
      // ファイルから読み込み
      const SERVICE_ACCOUNT_PATH = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || 
                                   path.join(__dirname, './serviceAccountKey.json');
      serviceAccount = JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_PATH, 'utf8'));
    }
    
    app = initializeApp({
      credential: cert(serviceAccount),
      // オプション：プロジェクトIDを明示的に指定
      projectId: serviceAccount.project_id
    });
    
    db = getFirestore(app);
    isInitialized = true;
    
    log.info('Firebase Admin SDKが正常に初期化されました');
    return db;
  } catch (error) {
    log.error(`Firebase Admin SDK初期化エラー: ${error.message}`);
    if (error.stack) {
      log.error(`スタックトレース: ${error.stack}`);
    }
    throw error;
  }
}

// 現在時刻を取得する関数
function getCurrentTimestamp() {
  return new Date();
}

export { db, getCurrentTimestamp };