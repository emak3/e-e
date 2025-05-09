import { initFirebaseAdmin, sanitizeData, getCurrentTimestamp } from '../firebase-admin-config.mjs';
import log from '../logger.mjs';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

// 関数エイリアスの作成
const getAdminDb = initFirebaseAdmin;

// __dirnameの代替
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const RSS_STATUS_PATH = path.join(__dirname, '../data/rss-status.json');

// コレクション名
const COLLECTION_NAME = 'rss_status';

// URLをハッシュ化してドキュメントIDにする関数
function getSafeDocumentId(url) {
  return crypto.createHash('md5').update(url).digest('hex');
}

// 日付を標準化する関数
function parseDate(dateStr) {
  if (!dateStr) return null;

  try {
    // 日付文字列の場合
    if (typeof dateStr === 'string') {
      const date = new Date(dateStr);
      // 有効な日付かチェック
      if (isNaN(date.getTime())) {
        log.warn(`無効な日付文字列: ${dateStr}`);
        return null;
      }
      return date;
    }

    // すでにDateオブジェクトの場合
    if (dateStr instanceof Date) {
      if (isNaN(dateStr.getTime())) {
        log.warn(`無効なDateオブジェクト`);
        return null;
      }
      return dateStr;
    }

    // それ以外の場合
    log.warn(`サポートされていない日付形式: ${typeof dateStr}`);
    return null;
  } catch (e) {
    log.error(`日付処理エラー: ${e.message}`);
    return null;
  }
}

/**
 * RSSステータスを更新する関数
 * @param {string} feedUrl - フィードURL
 * @param {string} lastItemId - 最後に処理したアイテムID
 * @param {string|Date} lastPublishDate - 最後に処理したアイテムの公開日
 * @param {string} lastTitle - 最後に処理したアイテムのタイトル
 * @returns {Promise<boolean>} - 成功したかどうか
 */
export async function updateRssStatus(feedUrl, lastItemId, lastPublishDate, lastTitle) {
  if (!feedUrl) {
    log.error("更新エラー: フィードURLが指定されていません");
    return false;
  }

  try {
    const db = await getAdminDb();

    // URLをハッシュ化してドキュメントIDにする
    const docId = getSafeDocumentId(feedUrl);

    // 日付の処理
    let parsedDate = null;
    if (lastPublishDate) {
      try {
        if (typeof lastPublishDate === 'string') {
          parsedDate = new Date(lastPublishDate);
        } else if (lastPublishDate instanceof Date) {
          parsedDate = lastPublishDate;
        } else if (lastPublishDate._seconds !== undefined) {
          parsedDate = new Date(lastPublishDate._seconds * 1000);
        }

        // 有効な日付かチェック
        if (parsedDate && isNaN(parsedDate.getTime())) {
          log.warn(`無効な日付: ${lastPublishDate}`);
          parsedDate = null;
        }
      } catch (e) {
        log.error(`日付処理エラー: ${e.message}`);
        parsedDate = null;
      }
    }

    // データを安全な形式に整形
    const data = sanitizeData({
      feedUrl,
      lastItemId: lastItemId || null,
      lastPublishDate: parsedDate,
      lastTitle: lastTitle || null,
      updatedAt: getCurrentTimestamp()
    });

    // デバッグログでデータを出力
    const debugData = {
      ...data,
      lastPublishDate: parsedDate ? parsedDate.toLocaleString('ja-JP') : null
    };
    log.debug(`保存するRSSデータ: ${JSON.stringify(debugData)}`);

    // ドキュメント参照
    const docRef = db.collection(COLLECTION_NAME).doc(docId);

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

    log.info(`RSS ${feedUrl} のステータスを更新しました`);
    return true;
  } catch (error) {
    log.error(`RSSステータス更新エラー (${feedUrl}): ${error.message}`);
    if (error.stack) {
      log.error(`スタックトレース: ${error.stack}`);
    }
    throw error;
  }
}

/**
 * フィードURLからRSSステータスを取得する関数
 * @param {string} feedUrl - フィードURL
 * @returns {Promise<Object|null>} - RSSステータスまたはnull
 */
export async function getRssStatus(feedUrl) {
  if (!feedUrl) {
    log.error("取得エラー: フィードURLが指定されていません");
    return null;
  }

  try {
    const db = await getAdminDb();
    const docId = getSafeDocumentId(feedUrl);
    const docRef = db.collection(COLLECTION_NAME).doc(docId);
    const doc = await docRef.get();

    if (doc.exists) {
      const data = doc.data();

      // 日付処理を追加
      let lastPublishDate = null;
      if (data.lastPublishDate) {
        if (data.lastPublishDate instanceof Date) {
          lastPublishDate = data.lastPublishDate;
        } else if (data.lastPublishDate._seconds !== undefined) {
          // Firestoreタイムスタンプの処理
          lastPublishDate = new Date(data.lastPublishDate._seconds * 1000);
        } else if (typeof data.lastPublishDate === 'string') {
          try {
            lastPublishDate = new Date(data.lastPublishDate);
          } catch (e) {
            log.warn(`日付文字列の変換エラー: ${e.message}`);
          }
        }
      }

      return {
        lastItemId: data.lastItemId || null,
        lastPublishDate: lastPublishDate,
        lastTitle: data.lastTitle || null
      };
    }
    return null;
  } catch (error) {
    log.error(`RSSステータス取得エラー (${feedUrl}): ${error.message}`);
    return null;
  }
}

/**
 * すべてのRSSステータスを取得する関数
 * @returns {Promise<Object>} - {feedUrl: statusObject}形式のオブジェクト
 */
export async function getAllRssStatus() {
  try {
    const db = await getAdminDb();
    const snapshot = await db.collection(COLLECTION_NAME).get();

    const statusObj = {};
    snapshot.forEach(doc => {
      const data = doc.data();
      if (data.feedUrl) {
        statusObj[data.feedUrl] = {
          lastItemId: data.lastItemId || null,
          lastPublishDate: data.lastPublishDate,
          lastTitle: data.lastTitle || null
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
 * @param {string} feedUrl - フィードURL
 * @returns {Promise<boolean>} - 成功したかどうか
 */
export async function deleteRssStatus(feedUrl) {
  if (!feedUrl) {
    log.error("削除エラー: フィードURLが指定されていません");
    return false;
  }

  try {
    const db = await getAdminDb();
    const docId = getSafeDocumentId(feedUrl);
    await db.collection(COLLECTION_NAME).doc(docId).delete();

    log.info(`RSS ${feedUrl} のステータスを削除しました`);
    return true;
  } catch (error) {
    log.error(`RSSステータス削除エラー (${feedUrl}): ${error.message}`);
    return false;
  }
}

/**
 * JSONファイルからFirestoreへデータを移行する関数
 * @returns {Promise<Object>} - 移行結果
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

    // Firestoreに挿入
    const db = await getAdminDb();
    const batch = db.batch();
    let batchCount = 0;
    const MAX_BATCH_SIZE = 500; // Firestoreの最大バッチサイズ

    for (const [feedUrl, status] of Object.entries(rssStatus)) {
      try {
        if (!feedUrl) {
          skippedCount++;
          continue;
        }

        const docId = getSafeDocumentId(feedUrl);
        const docRef = db.collection(COLLECTION_NAME).doc(docId);

        // 日付の処理
        const parsedDate = parseDate(status.lastPublishDate);

        const docData = sanitizeData({
          feedUrl,
          lastItemId: status.lastItemId || null,
          lastPublishDate: parsedDate,
          lastTitle: status.lastTitle || null,
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
          log.info(`${migratedCount}件のRSSステータスを移行しました`);
        }
      } catch (error) {
        log.error(`RSS ${feedUrl} のステータス移行エラー: ${error.message}`);
        skippedCount++;
      }
    }

    // 残りのバッチをコミット
    if (batchCount > 0) {
      await batch.commit();
      migratedCount += batchCount;
    }

    log.info(`RSSステータスの移行が完了しました。移行: ${migratedCount}, スキップ: ${skippedCount}`);
    return { migrated: migratedCount, skipped: skippedCount };
  } catch (error) {
    log.error(`RSSステータス移行エラー: ${error.message}`);
    throw error;
  }
}