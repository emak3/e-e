import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import log from './logger.mjs';

// __dirnameの代替
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// サービスアカウントのパス
const SERVICE_ACCOUNT_PATH = process.env.FIREBASE_SERVICE_ACCOUNT_PATH ||
  path.join(__dirname, './serviceAccountKey.json');

let adminApp = null;
let adminDb = null;

/**
 * Firebase Admin SDKを初期化する関数
 * @returns {FirebaseFirestore.Firestore} - Firestoreインスタンス
 */
export function initFirebaseAdmin() {
  if (adminDb) {
    return adminDb;
  }

  try {
    // サービスアカウントの読み込み
    let serviceAccount;
    try {
      serviceAccount = JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_PATH, 'utf8'));
    } catch (err) {
      log.error(`サービスアカウントファイルの読み込みエラー: ${err.message}`);
      log.error(`パス: ${SERVICE_ACCOUNT_PATH}`);
      throw err;
    }

    // Firebase Admin SDKの初期化
    adminApp = initializeApp({
      credential: cert(serviceAccount)
    });

    adminDb = getFirestore(adminApp);
    log.info('Firebase Admin SDKを初期化しました');

    return adminDb;
  } catch (error) {
    log.error(`Firebase Admin SDK初期化エラー: ${error.message}`);
    if (error.stack) {
      log.error(`スタックトレース: ${error.stack}`);
    }
    throw error;
  }
}

/**
 * 現在の日本時間（JST）のタイムスタンプを取得する関数
 * @returns {Date} - 現在の日時（日本時間）
 */
export function getCurrentTimestamp() {
  // 現在のUTC時間を取得
  const now = new Date();

  // JSTは UTC+9
  const jstTime = new Date(now.getTime() + (9 * 60 * 60 * 1000));

  // UTC時間に9時間を追加（ミリ秒に変換）
  return jstTime;
}

/**
 * データをFirestore用に整形する関数
 * @param {Object} data - 整形するデータ
 * @returns {Object} - 整形されたデータ
 */
export function sanitizeData(data) {
  // nullとundefinedを処理
  if (data === null || data === undefined) {
    return null;
  }

  // 配列を処理
  if (Array.isArray(data)) {
    return data.map(item => sanitizeData(item)).filter(item => item !== undefined);
  }

  // オブジェクトを処理
  if (typeof data === 'object' && !(data instanceof Date)) {
    const result = {};
    for (const [key, value] of Object.entries(data)) {
      // undefinedは除外
      if (value !== undefined) {
        result[key] = sanitizeData(value);
      }
    }
    return result;
  }

  // その他のプリミティブ値はそのまま
  return data;
}

// この行を追加: getAdminDbエイリアスを作成
export const getAdminDb = initFirebaseAdmin;