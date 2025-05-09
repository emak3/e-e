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
import crypto from 'crypto';

// __dirnameの代替
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const RSS_STATUS_PATH = path.join(__dirname, '../data/rss-status.json');

// Firestoreコレクション参照
const rssCollection = collection(db, 'rss_status');

// URLをハッシュ化してドキュメントIDにする関数
function getSafeDocumentId(url) {
  return crypto.createHash('md5').update(url).digest('hex');
}

// データをFirestore用に整形する関数
function sanitizeData(data) {
  return JSON.parse(JSON.stringify(data));
}

// 日付文字列を標準化する関数
function formatDate(dateStr) {
  if (!dateStr) return null;
  
  try {
    const date = new Date(dateStr);
    // 有効な日付かチェック
    if (isNaN(date.getTime())) {
      return null;
    }
    return date.toISOString();
  } catch (e) {
    return null;
  }
}

/**
 * RSSステータスを更新する関数
 */
export async function updateRssStatus(feedUrl, lastItemId, lastPublishDate, lastTitle) {
  try {
    // URLをハッシュ化してドキュメントIDにする
    const docId = getSafeDocumentId(feedUrl);
    const rssRef = doc(rssCollection, docId);
    
    // 日付の標準化
    const formattedDate = formatDate(lastPublishDate);
    
    const data = sanitizeData({
      feedUrl,
      lastItemId: lastItemId || null,
      lastPublishDate: formattedDate,
      lastTitle: lastTitle || null,
      updatedAt: getCurrentTimestamp()
    });
    
    log.debug(`保存するRSSデータ: ${JSON.stringify(data)}`);
    
    await setDoc(rssRef, data, { merge: true });
    
    log.info(`RSS ${feedUrl} のステータスを更新しました`);
    return true;
  } catch (error) {
    log.error(`RSSステータス更新エラー: ${error.message}`);
    if (error.stack) {
      log.error(`スタックトレース: ${error.stack}`);
    }
    throw error;
  }
}

/**
 * フィードURLからRSSステータスを取得する関数
 */
export async function getRssStatus(feedUrl) {
  try {
    const docId = getSafeDocumentId(feedUrl);
    const rssRef = doc(rssCollection, docId);
    const rssSnap = await getDoc(rssRef);
    
    if (rssSnap.exists()) {
      const data = rssSnap.data();
      return {
        lastItemId: data.lastItemId,
        lastPublishDate: data.lastPublishDate,
        lastTitle: data.lastTitle
      };
    }
    return null;
  } catch (error) {
    log.error(`RSSステータス取得エラー: ${error.message}`);
    return null;
  }
}

/**
 * すべてのRSSステータスを取得する関数
 */
export async function getAllRssStatus() {
  try {
    const snapshot = await getDocs(rssCollection);
    
    const statusObj = {};
    snapshot.forEach(doc => {
      const data = doc.data();
      if (data.feedUrl) {  // feedUrlがある場合のみ
        statusObj[data.feedUrl] = {
          lastItemId: data.lastItemId,
          lastPublishDate: data.lastPublishDate,
          lastTitle: data.lastTitle
        };
      }
    });
    
    return statusObj;
  } catch (error) {
    log.error(`全RSSステータス取得エラー: ${error.message}`);
    return {};
  }
}

/**
 * RSSステータスを削除する関数
 */
export async function deleteRssStatus(feedUrl) {
  try {
    const docId = getSafeDocumentId(feedUrl);
    const rssRef = doc(rssCollection, docId);
    await deleteDoc(rssRef);
    
    log.info(`RSS ${feedUrl} のステータスを削除しました`);
    return true;
  } catch (error) {
    log.error(`RSSステータス削除エラー: ${error.message}`);
    return false;
  }
}

/**
 * JSONファイルからFirestoreへデータを移行する関数
 */
export async function migrateRssStatusToDatabase() {
  try {
    // JSONファイルが存在するか確認
    try {
      await fs.access(RSS_STATUS_PATH);
    } catch (error) {
      log.info('RSSステータスJSONファイルが存在しません。マイグレーションをスキップします。');
      return { migrated: 0, skipped: 0 };
    }

    // JSONファイルを読み込み
    const data = await fs.readFile(RSS_STATUS_PATH, 'utf-8');
    const rssStatus = JSON.parse(data);
    
    // 統計用変数
    let migratedCount = 0;
    let skippedCount = 0;
    
    for (const [feedUrl, status] of Object.entries(rssStatus)) {
      try {
        const docId = getSafeDocumentId(feedUrl);
        const rssRef = doc(rssCollection, docId);
        
        // 日付の標準化
        const formattedDate = formatDate(status.lastPublishDate);
        
        const docData = sanitizeData({
          feedUrl,
          lastItemId: status.lastItemId || null,
          lastPublishDate: formattedDate,
          lastTitle: status.lastTitle || null,
          createdAt: getCurrentTimestamp(),
          updatedAt: getCurrentTimestamp()
        });
        
        await setDoc(rssRef, docData);
        
        migratedCount++;
        log.debug(`RSS ${feedUrl} のステータスを移行しました`);
      } catch (error) {
        log.error(`RSS ${feedUrl} のステータス移行エラー: ${error.message}`);
        skippedCount++;
      }
    }
    
    log.info(`RSSステータスの移行が完了しました。移行: ${migratedCount}, スキップ: ${skippedCount}`);
    return { migrated: migratedCount, skipped: skippedCount };
  } catch (error) {
    log.error(`RSSステータス移行エラー: ${error.message}`);
    throw error;
  }
}