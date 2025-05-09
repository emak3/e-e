import { 
    collection, 
    doc, 
    setDoc, 
    getDoc, 
    getDocs, 
    deleteDoc, 
    serverTimestamp 
} from 'firebase-admin/firestore';
import { admin } from '../firebase-admin-config.mjs';
import log from '../logger.mjs';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

// __dirnameの代替
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const RSS_STATUS_PATH = path.join(__dirname, '../data/rss-status.json');

// Firestoreコレクション参照
const rssCollection = collection(db, 'rss_status');

/**
 * RSSステータスを更新する関数
 * @param {string} feedUrl - フィードURL
 * @param {string} lastItemId - 最後に処理したアイテムID
 * @param {string} lastPublishDate - 最後に処理したアイテムの公開日
 * @param {string} lastTitle - 最後に処理したアイテムのタイトル
 * @returns {Promise<boolean>} - 成功したかどうか
 */
export async function updateRssStatus(feedUrl, lastItemId, lastPublishDate, lastTitle) {
    try {
        // URLをドキュメントIDとして使用すると長すぎる場合があるため、ハッシュ化する
        const docId = Buffer.from(feedUrl).toString('base64');
        const rssRef = doc(rssCollection, docId);
        
        await setDoc(rssRef, {
            feedUrl,
            lastItemId,
            lastPublishDate,
            lastTitle,
            updatedAt: serverTimestamp()
        }, { merge: true });
        
        log.info(`RSS ${feedUrl} のステータスを更新しました`);
        return true;
    } catch (error) {
        log.error('RSSステータス更新エラー:', error);
        throw error;
    }
}

/**
 * フィードURLからRSSステータスを取得する関数
 * @param {string} feedUrl - フィードURL
 * @returns {Promise<Object|null>} - RSSステータスまたはnull
 */
export async function getRssStatus(feedUrl) {
    try {
        const docId = Buffer.from(feedUrl).toString('base64');
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
        log.error('RSSステータス取得エラー:', error);
        return null;
    }
}

/**
 * すべてのRSSステータスを取得する関数
 * @returns {Promise<Object>} - {feedUrl: statusObject}形式のオブジェクト
 */
export async function getAllRssStatus() {
    try {
        const snapshot = await getDocs(rssCollection);
        
        const statusObj = {};
        snapshot.forEach(doc => {
            const data = doc.data();
            statusObj[data.feedUrl] = {
                lastItemId: data.lastItemId,
                lastPublishDate: data.lastPublishDate,
                lastTitle: data.lastTitle
            };
        });
        
        return statusObj;
    } catch (error) {
        log.error('全RSSステータス取得エラー:', error);
        return {};
    }
}

/**
 * RSSステータスを削除する関数
 * @param {string} feedUrl - フィードURL
 * @returns {Promise<boolean>} - 成功したかどうか
 */
export async function deleteRssStatus(feedUrl) {
    try {
        const docId = Buffer.from(feedUrl).toString('base64');
        const rssRef = doc(rssCollection, docId);
        await deleteDoc(rssRef);
        
        log.info(`RSS ${feedUrl} のステータスを削除しました`);
        return true;
    } catch (error) {
        log.error('RSSステータス削除エラー:', error);
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
        for (const [feedUrl, status] of Object.entries(rssStatus)) {
            try {
                const docId = Buffer.from(feedUrl).toString('base64');
                const rssRef = doc(rssCollection, docId);
                
                await setDoc(rssRef, {
                    feedUrl,
                    lastItemId: status.lastItemId,
                    lastPublishDate: status.lastPublishDate,
                    lastTitle: status.lastTitle,
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp()
                });
                
                migratedCount++;
                log.debug(`RSS ${feedUrl} のステータスを移行しました`);
            } catch (error) {
                log.error(`RSS ${feedUrl} のステータス移行エラー:`, error);
                skippedCount++;
            }
        }
        
        log.info(`RSSステータスの移行が完了しました。移行: ${migratedCount}, スキップ: ${skippedCount}`);
        return { migrated: migratedCount, skipped: skippedCount };
    } catch (error) {
        log.error('RSSステータス移行エラー:', error);
        throw error;
    }
}