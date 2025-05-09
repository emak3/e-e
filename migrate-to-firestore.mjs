import { migrateEmailsToDatabase } from './utils/email-database.mjs';
import { migrateRssStatusToDatabase } from './utils/rss-database.mjs';
import log from './logger.mjs';
import { getConfig } from './config.mjs';

// 環境変数の読み込み
getConfig();

async function migrateToFirestore() {
    try {
        log.info('JSONからFirestoreへの移行を開始します...');
        
        // メールデータベースの移行
        log.info('メールデータベースの移行を開始...');
        const emailMigrationResult = await migrateEmailsToDatabase();
        log.info(`メールデータベース移行結果: 成功=${emailMigrationResult.migrated}, 失敗=${emailMigrationResult.skipped}`);
        
        // RSSステータスの移行
        log.info('RSSステータスの移行を開始...');
        const rssMigrationResult = await migrateRssStatusToDatabase();
        log.info(`RSSステータス移行結果: 成功=${rssMigrationResult.migrated}, 失敗=${rssMigrationResult.skipped}`);
        
        log.info('移行が完了しました');
        process.exit(0);
    } catch (error) {
        log.error('移行中にエラーが発生しました:', error);
        process.exit(1);
    }
}

migrateToFirestore();