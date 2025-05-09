import { initFirebaseAdmin, sanitizeData } from '../firebase-admin-config.mjs';
import log from '../logger.mjs';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

// エイリアスを作成
const getAdminDb = initFirebaseAdmin;

// 現在の時刻を取得する関数
function getCurrentTimestamp() {
  return new Date();
}

// __dirnameの代替
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const EMAIL_DB_PATH = path.join(__dirname, '../data/email-database.json');

// コレクション名
const COLLECTION_NAME = 'email_database';

/**
 * メールアドレスを保存する関数
 * @param {string} userId - ユーザーID
 * @param {string} email - メールアドレス
 * @returns {Promise<boolean>} - 成功したかどうか
 */
export async function saveEmail(userId, email) {
  if (!userId) {
    log.error("保存エラー: ユーザーIDが指定されていません");
    return false;
  }

  try {
    const db = getAdminDb();
    
    // 保存するデータを作成
    const data = sanitizeData({
      email: email || null,
      userId, // 冗長だがクエリで使うために保存
      updatedAt: getCurrentTimestamp()
    });
    
    // デバッグログ
    log.debug(`保存するデータ (${userId}): ${JSON.stringify(data)}`);
    
    // ドキュメント参照
    const docRef = db.collection(COLLECTION_NAME).doc(userId);
    
    // 既存ドキュメントの確認
    const doc = await docRef.get();
    if (doc.exists) {
      // 既存のデータがある場合は作成日を保持
      delete data.createdAt;
      await docRef.update(data);
    } else {
      // 作成日を設定
      data.createdAt = getCurrentTimestamp();
      // 新規作成
      await docRef.set(data);
    }
    
    log.info(`ユーザー ${userId} のメールアドレスを保存しました`);
    return true;
  } catch (error) {
    log.error(`メールアドレス保存エラー (${userId}): ${error.message}`);
    if (error.stack) {
      log.error(`スタックトレース: ${error.stack}`);
    }
    throw error;
  }
}

/**
 * メールアドレスを取得する関数
 * @param {string} userId - ユーザーID
 * @returns {Promise<string|null>} - メールアドレスまたはnull
 */
export async function getEmail(userId) {
  if (!userId) {
    log.error("取得エラー: ユーザーIDが指定されていません");
    return null;
  }

  try {
    const db = getAdminDb();
    const docRef = db.collection(COLLECTION_NAME).doc(userId);
    const doc = await docRef.get();
    
    if (doc.exists) {
      return doc.data().email;
    }
    return null;
  } catch (error) {
    log.error(`メールアドレス取得エラー (${userId}): ${error.message}`);
    return null;
  }
}

/**
 * 全メールアドレスをオブジェクトとして取得
 * @returns {Promise<Object>} - {userId: email}形式のオブジェクト
 */
export async function getAllEmails() {
  try {
    const db = getAdminDb();
    const snapshot = await db.collection(COLLECTION_NAME).get();
    
    const emailsObj = {};
    snapshot.forEach(doc => {
      const data = doc.data();
      if (data.email) {
        emailsObj[doc.id] = data.email;
      }
    });
    
    return emailsObj;
  } catch (error) {
    log.error(`全メールアドレス取得エラー: ${error.message}`);
    return {};
  }
}

/**
 * メールアドレスを削除する関数
 * @param {string} userId - ユーザーID
 * @returns {Promise<boolean>} - 成功したかどうか
 */
export async function deleteEmail(userId) {
  if (!userId) {
    log.error("削除エラー: ユーザーIDが指定されていません");
    return false;
  }

  try {
    const db = getAdminDb();
    await db.collection(COLLECTION_NAME).doc(userId).delete();
    
    log.info(`ユーザー ${userId} のメールアドレスを削除しました`);
    return true;
  } catch (error) {
    log.error(`メールアドレス削除エラー (${userId}): ${error.message}`);
    return false;
  }
}

/**
 * JSONファイルからFirestoreへデータを移行する関数
 * @returns {Promise<Object>} - 移行結果
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
    
    // Firestoreに挿入
    const db = getAdminDb();
    const batch = db.batch();
    let batchCount = 0;
    const MAX_BATCH_SIZE = 500; // Firestoreの最大バッチサイズ
    
    for (const [userId, email] of Object.entries(emailDatabase)) {
      try {
        if (!userId || !email) {
          skippedCount++;
          continue;
        }
        
        const docRef = db.collection(COLLECTION_NAME).doc(userId);
        
        const docData = sanitizeData({
          email,
          userId,
          createdAt: getCurrentTimestamp(),
          updatedAt: getCurrentTimestamp()
        });
        
        batch.set(docRef, docData);
        batchCount++;
        
        // バッチサイズが上限に達したらコミット
        if (batchCount >= MAX_BATCH_SIZE) {
          await batch.commit();
          migratedCount += batchCount;
          batchCount = 0;
          log.info(`${migratedCount}件のメールアドレスを移行しました`);
        }
      } catch (error) {
        log.error(`ユーザー ${userId} のメールアドレス移行エラー: ${error.message}`);
        skippedCount++;
      }
    }
    
    // 残りのバッチをコミット
    if (batchCount > 0) {
      await batch.commit();
      migratedCount += batchCount;
    }
    
    log.info(`メールデータベースの移行が完了しました。移行: ${migratedCount}, スキップ: ${skippedCount}`);
    return { migrated: migratedCount, skipped: skippedCount };
  } catch (error) {
    log.error(`メールデータベース移行エラー: ${error.message}`);
    throw error;
  }
}