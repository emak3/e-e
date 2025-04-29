import log from "../logger.mjs";

// セッション情報を保持するマップ
// キー: メッセージID、値: セッション情報オブジェクト
const studentSessions = new Map();

/**
 * セッション情報を作成または更新する関数
 * @param {string} messageId - メッセージID
 * @param {string} userId - ユーザーID
 * @param {Array} students - 学生情報の配列
 * @returns {boolean} - 成功したかどうか
 */
export function createOrUpdateSession(messageId, userId, students) {
    try {
        studentSessions.set(messageId, {
            userId,
            students,
            createdAt: Date.now(),
            // 5分後に自動期限切れ
            expiresAt: Date.now() + 5 * 60 * 1000
        });
        
        log.debug(`学生セッションを作成/更新しました: ${messageId}`);
        return true;
    } catch (error) {
        log.error('セッション作成/更新エラー:', error);
        return false;
    }
}

/**
 * セッション情報を取得する関数
 * @param {string} messageId - メッセージID
 * @returns {Object|null} - セッション情報またはnull（存在しない、または期限切れの場合）
 */
export function getSession(messageId) {
    try {
        // セッション情報の取得
        const session = studentSessions.get(messageId);
        
        // セッションが存在しない場合
        if (!session) {
            log.debug(`セッションが存在しません: ${messageId}`);
            return null;
        }
        
        // セッションの期限切れチェック
        if (session.expiresAt < Date.now()) {
            log.debug(`セッションが期限切れです: ${messageId}`);
            studentSessions.delete(messageId);
            return null;
        }
        
        return session;
    } catch (error) {
        log.error('セッション取得エラー:', error);
        return null;
    }
}

/**
 * セッションから学生情報を取得する関数
 * @param {string} messageId - メッセージID
 * @param {string} userId - ユーザーID（セッションのユーザーIDと一致するか確認）
 * @returns {Array|null} - 学生情報の配列またはnull
 */
export function getStudentsFromSession(messageId, userId) {
    try {
        const session = getSession(messageId);
        
        // セッションが存在しない、または期限切れの場合
        if (!session) {
            return null;
        }
        
        // ユーザーIDが一致しない場合
        if (session.userId !== userId) {
            log.debug(`ユーザーIDが一致しません: ${userId} != ${session.userId}`);
            return null;
        }
        
        // セッションの有効期限を延長
        session.expiresAt = Date.now() + 5 * 60 * 1000;
        studentSessions.set(messageId, session);
        
        return session.students;
    } catch (error) {
        log.error('セッションからの学生情報取得エラー:', error);
        return null;
    }
}

/**
 * セッションを削除する関数
 * @param {string} messageId - メッセージID
 * @returns {boolean} - 成功したかどうか
 */
export function deleteSession(messageId) {
    try {
        studentSessions.delete(messageId);
        log.debug(`セッションを削除しました: ${messageId}`);
        return true;
    } catch (error) {
        log.error('セッション削除エラー:', error);
        return false;
    }
}

/**
 * 期限切れのセッションをクリーンアップする関数
 * 定期的に呼び出すことを推奨
 * @returns {number} - 削除されたセッションの数
 */
export function cleanupExpiredSessions() {
    try {
        const now = Date.now();
        let count = 0;
        
        for (const [messageId, session] of studentSessions.entries()) {
            if (session.expiresAt < now) {
                studentSessions.delete(messageId);
                count++;
            }
        }
        
        if (count > 0) {
            log.debug(`${count}件の期限切れセッションを削除しました`);
        }
        
        return count;
    } catch (error) {
        log.error('セッションクリーンアップエラー:', error);
        return 0;
    }
}

// 10分ごとに期限切れセッションをクリーンアップ
setInterval(cleanupExpiredSessions, 10 * 60 * 1000);