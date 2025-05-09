import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs,
  deleteDoc 
} from 'firebase/firestore';
import { db, getCurrentTimestamp } from '../firebase-config.mjs';
import log from '../logger.mjs';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

// __dirnameの代替
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const EMAIL_DB_PATH = path.join(__dirname, '../data/email-database.json');

// Firestoreコレクション参照
const emailsCollection = collection(db, 'email_database');

// データをFirestore用に整形する関数
function sanitizeData(data) {
  // undefined, 関数などを除去
  return JSON.parse(JSON.stringify(data));
}

/**
 * メールアドレスを保存する関数
 */
export async function saveEmail(userId, email) {
  try {
    const emailRef = doc(emailsCollection, userId);
    
    const data = sanitizeData({
      email,
      updatedAt: getCurrentTimestamp()
    });
    
    log.debug(`保存するデータ: ${JSON.stringify(data)}`);
    
    await setDoc(emailRef, data, { merge: true });
    
    log.info(`ユーザー ${userId} のメールアドレスを保存しました`);
    return true;
  } catch (error) {
    log.error(`メールアドレス保存エラー: ${error.message}`);
    if (error.stack) {
      log.error(`スタックトレース: ${error.stack}`);
    }
    throw error;
  }
}

/**
 * メールアドレスを取得する関数
 */
export async function getEmail(userId) {
  try {
    const emailRef = doc(emailsCollection, userId);
    const emailSnap = await getDoc(emailRef);
    
    if (emailSnap.exists()) {
      return emailSnap.data().email;
    }
    return null;
  } catch (error) {
    log.error(`メールアドレス取得エラー: ${error.message}`);
    return null;
  }
}

/**
 * 全メールアドレスをオブジェクトとして取得
 */
export async function getAllEmails() {
  try {
    const snapshot = await getDocs(emailsCollection);
    
    const emailsObj = {};
    snapshot.forEach(doc => {
      emailsObj[doc.id] = doc.data().email;
    });
    
    return emailsObj;
  } catch (error) {
    log.error(`全メールアドレス取得エラー: ${error.message}`);
    return {};
  }
}

/**
 * メールアドレスを削除する関数
 */
export async function deleteEmail(userId) {
  try {
    const emailRef = doc(emailsCollection, userId);
    await deleteDoc(emailRef);
    
    log.info(`ユーザー ${userId} のメールアドレスを削除しました`);
    return true;
  } catch (error) {
    log.error(`メールアドレス削除エラー: ${error.message}`);
    return false;
  }
}

/**
 * JSONファイルからFirestoreへデータを移行する関数
 */
export async function migrateEmailsToDatabase() {
  try {
    // JSONファイルが存在するか確認
    try {
      await fs.access(EMAIL_DB_PATH);
    } catch (error) {
      log.info('メールデータベースJSONファイルが存在しません。マイグレーションをスキップします。');
      return { migrated: 0, skipped: 0 };
    }

    // JSONファイルを読み込み
    const data = await fs.readFile(EMAIL_DB_PATH, 'utf-8');
    const emailDatabase = JSON.parse(data);
    
    // 統計用変数
    let migratedCount = 0;
    let skippedCount = 0;
    
    for (const [userId, email] of Object.entries(emailDatabase)) {
      try {
        const emailRef = doc(emailsCollection, userId);
        
        const docData = sanitizeData({
          email,
          createdAt: getCurrentTimestamp(),
          updatedAt: getCurrentTimestamp()
        });
        
        await setDoc(emailRef, docData);
        
        migratedCount++;
        log.debug(`ユーザー ${userId} のメールアドレスを移行しました`);
      } catch (error) {
        log.error(`ユーザー ${userId} のメールアドレス移行エラー: ${error.message}`);
        skippedCount++;
      }
    }
    
    log.info(`メールデータベースの移行が完了しました。移行: ${migratedCount}, スキップ: ${skippedCount}`);
    return { migrated: migratedCount, skipped: skippedCount };
  } catch (error) {
    log.error(`メールデータベース移行エラー: ${error.message}`);
    throw error;
  }
}