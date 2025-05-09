import { 
    collection, 
    doc, 
    setDoc, 
    getDoc, 
    getDocs, 
    deleteDoc, 
    serverTimestamp,
    query,
    where
} from 'firebase-admin/firestore';
import { db } from '../firebase-admin-config.mjs';
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

/**
 * メールアドレスを保存する関数
 * @param {string} userId - ユーザーID
 * @param {string} email - メールアドレス
 * @returns {Promise<boolean>} - 成功したかどうか
 */
export async function saveEmail(userId, email) {
    try {
        const emailRef = doc(emailsCollection, userId);
        
        await setDoc(emailRef, {
            email,
            updatedAt: serverTimestamp()
        }, { merge: true });
        
        log.info(`ユーザー ${userId} のメールアドレスを保存しました`);
        return true;
    } catch (error) {
        log.error('メールアドレス保存エラー:', error);
        throw error;
    }
}

/**
 * メールアドレスを取得する関数
 * @param {string} userId - ユーザーID
 * @returns {Promise<string|null>} - メールアドレスまたはnull
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
        log.error('メールアドレス取得エラー:', error);
        return null;
    }
}

/**
 * ユーザーIDからメールアドレスを検索する関数
 * @param {string} email - 検索するメールアドレス
 * @returns {Promise<string|null>} - 見つかったユーザーIDまたはnull
 */
export async function findUserIdByEmail(email) {
    try {
        const q = query(emailsCollection, where("email", "==", email));
        const querySnapshot = await getDocs(q);
        
        if (!querySnapshot.empty) {
            return querySnapshot.docs[0].id;
        }
        return null;
    } catch (error) {
        log.error('メールアドレス検索エラー:', error);
        return null;
    }
}

/**
 * 全メールアドレスをオブジェクトとして取得
 * @returns {Promise<Object>} - {userId: email}形式のオブジェクト
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
        log.error('全メールアドレス取得エラー:', error);
        return {};
    }
}

/**
 * メールアドレスを削除する関数
 * @param {string} userId - ユーザーID
 * @returns {Promise<boolean>} - 成功したかどうか
 */
export async function deleteEmail(userId) {
    try {
        const emailRef = doc(emailsCollection, userId);
        await deleteDoc(emailRef);
        
        log.info(`ユーザー ${userId} のメールアドレスを削除しました`);
        return true;
    } catch (error) {
        log.error('メールアドレス削除エラー:', error);
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
        
        // バッチ処理の実装（Firestoreはバッチサイズに制限があるため）
        const entries = Object.entries(emailDatabase);
        for (const [userId, email] of entries) {
            try {
                const emailRef = doc(emailsCollection, userId);
                
                await setDoc(emailRef, {
                    email,
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp()
                });
                
                migratedCount++;
                log.debug(`ユーザー ${userId} のメールアドレスを移行しました`);
            } catch (error) {
                log.error(`ユーザー ${userId} のメールアドレス移行エラー:`, error);
                skippedCount++;
            }
        }
        
        log.info(`メールデータベースの移行が完了しました。移行: ${migratedCount}, スキップ: ${skippedCount}`);
        return { migrated: migratedCount, skipped: skippedCount };
    } catch (error) {
        log.error('メールデータベース移行エラー:', error);
        throw error;
    }
}