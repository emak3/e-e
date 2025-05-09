import {
    ContainerBuilder,
    TextDisplayBuilder,
    MessageFlags,
    ButtonBuilder,
    ButtonStyle,
    FileBuilder,
    ComponentType,
    SectionBuilder,
    ThumbnailBuilder,
    SeparatorSpacingSize,
    MediaGalleryBuilder,
    MediaGalleryItem,
    MediaGalleryItemBuilder,
    AttachmentBuilder
} from 'discord.js';
import { getConfig } from '../config.mjs';
import log from "../logger.mjs";
import Parser from 'rss-parser';
import cron from 'node-cron';
import axios from 'axios';
import getWebhookInChannel from "../utils/webhookGet.mjs";
import { getFavicon } from './favicon-utils.mjs';
import { JSDOM } from 'jsdom';
// Firestoreとの連携用に追加
import { 
    getRssStatus, 
    updateRssStatus, 
    getAllRssStatus 
} from '../utils/rss-database.mjs';

// RSSパーサーの設定
const parser = new Parser({
    customFields: {
        item: [
            ['media:thumbnail', 'mediaThumbnail'],
            ['media:content', 'mediaContent'],
            ['enclosure', 'enclosure'],
            ['image', 'image']
        ]
    }
});

// WebページからOGP画像を取得する関数
async function getOgImage(url) {
    try {
        const response = await axios.get(url);
        const html = response.data;
        const dom = new JSDOM(html);
        const document = dom.window.document;

        // OGP画像を検索
        const ogImage = document.querySelector('meta[property="og:image"]');
        if (ogImage && ogImage.getAttribute('content')) {
            return ogImage.getAttribute('content');
        }

        // Twitter Card画像を検索
        const twitterImage = document.querySelector('meta[name="twitter:image"]');
        if (twitterImage && twitterImage.getAttribute('content')) {
            return twitterImage.getAttribute('content');
        }

        // 最初の大きい画像を検索
        const images = Array.from(document.querySelectorAll('img'));
        const largeImages = images.filter(img => {
            const width = parseInt(img.getAttribute('width') || '0', 10);
            const height = parseInt(img.getAttribute('height') || '0', 10);
            return (width >= 200 && height >= 200) || (img.src && (img.src.includes('header') || img.src.includes('thumbnail') || img.src.includes('eyecatch')));
        });

        if (largeImages.length > 0) {
            let imgSrc = largeImages[0].getAttribute('src');
            // 相対パスを絶対パスに変換
            if (imgSrc && imgSrc.startsWith('/')) {
                const baseUrl = new URL(url);
                imgSrc = `${baseUrl.protocol}//${baseUrl.host}${imgSrc}`;
            } else if (imgSrc && !imgSrc.startsWith('http')) {
                const baseUrl = new URL(url);
                imgSrc = `${baseUrl.protocol}//${baseUrl.host}/${imgSrc}`;
            }
            return imgSrc;
        }

        return null;
    } catch (error) {
        log.error(`ページ画像取得エラー (${url}): ${error.message}`);
        return null;
    }
}

// RSSアイテムから画像URLを取得する関数
async function getImageFromItem(item) {
    // RSSパーサーで取得した項目をチェック
    if (item.mediaThumbnail && item.mediaThumbnail.$ && item.mediaThumbnail.$.url) {
        return item.mediaThumbnail.$.url;
    }

    if (item.mediaContent && item.mediaContent.$ && item.mediaContent.$.url) {
        return item.mediaContent.$.url;
    }

    if (item.enclosure && item.enclosure.url &&
        item.enclosure.type && item.enclosure.type.startsWith('image/')) {
        return item.enclosure.url;
    }

    if (item.image && item.image.url) {
        return item.image.url;
    }

    // RSSにメディアがない場合は、実際の記事ページからOGP画像を取得
    if (item.link) {
        try {
            const ogImage = await getOgImage(item.link);
            if (ogImage) {
                return ogImage;
            }
        } catch (error) {
            log.error(`OGP画像取得エラー: ${error.message}`);
        }
    }

    return null;
}

// 安全に日付を比較する関数
function safeCompareDate(date1, date2) {
    try {
        // nullやundefinedの場合
        if (!date1 || !date2) return false;
        
        // 日付オブジェクトに変換
        const d1 = typeof date1 === 'string' ? new Date(date1) : date1;
        const d2 = typeof date2 === 'string' ? new Date(date2) : date2;
        
        // 有効な日付かどうかチェック
        if (isNaN(d1.getTime()) || isNaN(d2.getTime())) {
            return false;
        }
        
        // ミリ秒単位で比較
        return d1.getTime() > d2.getTime();
    } catch (e) {
        log.error(`日付比較エラー: ${e.message}`);
        return false;
    }
}
// 安全に日付を比較する関数
function safeCompareDate(date1, date2) {
    try {
        // nullやundefinedの場合
        if (!date1 || !date2) return false;
        
        // 日付オブジェクトに変換
        const d1 = typeof date1 === 'string' ? new Date(date1) : date1;
        const d2 = typeof date2 === 'string' ? new Date(date2) : date2;
        
        // 有効な日付かどうかチェック
        if (isNaN(d1.getTime()) || isNaN(d2.getTime())) {
            return false;
        }
        
        // ミリ秒単位で比較
        return d1.getTime() > d2.getTime();
    } catch (e) {
        log.error(`日付比較エラー: ${e.message}`);
        return false;
    }
}

// RSSフィードを取得して処理する関数
async function processRssFeeds(client) {
    log.info('RSSフィードの処理を開始します');

    try {
        // 現在のRSSステータスを読み込み (Firestoreから)
        const rssStatus = await getAllRssStatus();
        log.debug(`RSSステータス読み込み完了: ${Object.keys(rssStatus).length}件のフィード情報`);
        
        const config = getConfig();
        const rssConfig = config.rssConfig || [];

        if (rssConfig.length === 0) {
            log.info('RSSフィードが設定されていません');
            return;
        }

        // 各RSSフィードを処理
        for (const feed of rssConfig) {
            try {
                log.info(`フィード処理: ${feed.name} (${feed.url})`);

                // RSSフィードを取得
                const feedData = await parser.parseURL(feed.url);
                log.debug(`フィード ${feed.url} から ${feedData.items.length}件のアイテムを取得`);

                // このフィードの最後に処理したアイテムのIDまたは日付を取得
                const lastProcessed = await getRssStatus(feed.url) || {
                    lastItemId: null,
                    lastPublishDate: null,
                    lastTitle: null
                };
                
                // 安全なログ出力（toISOString()を使わない）
                log.debug(`フィード ${feed.url} の最終処理情報:` + 
                         ` lastItemId=${lastProcessed.lastItemId || 'なし'},` +
                         ` lastPublishDate=${safeFormatDate(lastProcessed.lastPublishDate)},` +
                         ` lastTitle=${lastProcessed.lastTitle || 'なし'}`);

                // 新しいアイテムをフィルタリング（ロジックを修正）
                const newItems = [];
                
                for (const item of feedData.items) {
                    let isNew = false;

                    // まず、IDによる比較
                    if (item.guid && lastProcessed.lastItemId) {
                        isNew = item.guid !== lastProcessed.lastItemId;
                        log.debug(`アイテム "${item.title}" - GUIDによる比較: ${isNew ? '新規' : '既存'}`);
                    } 
                    // 次に日付による比較
                    else if (item.pubDate && lastProcessed.lastPublishDate) {
                        // 安全な日付比較関数を使用
                        isNew = safeCompareDate(item.pubDate, lastProcessed.lastPublishDate);
                        log.debug(`アイテム "${item.title}" - 日付による比較: ${isNew ? '新規' : '既存'} ` +
                                 `(${safeFormatDate(item.pubDate)} vs ${safeFormatDate(lastProcessed.lastPublishDate)})`);
                    } 
                    // 最後にタイトルによる比較
                    else if (item.title && lastProcessed.lastTitle) {
                        isNew = item.title !== lastProcessed.lastTitle;
                        log.debug(`アイテム "${item.title}" - タイトルによる比較: ${isNew ? '新規' : '既存'}`);
                    } 
                    // どれも比較できない場合は新規とみなす
                    else {
                        isNew = true;
                        log.debug(`アイテム "${item.title}" - 比較不能のため新規とみなす`);
                    }

                    if (isNew) {
                        newItems.push(item);
                    }
                }

                // 新しいアイテムを日付順（古い順）にソート
                newItems.sort((a, b) => {
                    try {
                        const dateA = a.pubDate ? new Date(a.pubDate).getTime() : 0;
                        const dateB = b.pubDate ? new Date(b.pubDate).getTime() : 0;
                        
                        // 無効な日付をチェック
                        if (isNaN(dateA) || isNaN(dateB)) {
                            return 0; // 日付が無効な場合は並び順を変更しない
                        }
                        
                        return dateA - dateB;
                    } catch (e) {
                        log.error(`日付ソートエラー: ${e.message}`);
                        return 0;
                    }
                });

                log.info(`フィード ${feed.url} の新しいアイテム数: ${newItems.length}`);

                // フィードのwebサイトドメインを取得してファビコンを取得
                const domain = extractDomain(feed.url) || extractDomain(feedData.link);
                let faviconUrl = null;

                if (domain) {
                    try {
                        faviconUrl = await getFavicon(domain);
                        log.debug(`ファビコン取得成功: ${faviconUrl}`);
                    } catch (faviconError) {
                        log.error(`ファビコン取得エラー: ${faviconError}`);
                    }
                }

                // 新しいアイテムをチャンネルに送信
                for (const item of newItems) {
                    log.debug(`新しいアイテムを送信: ${item.title}`);
                    
                    // 設定されたすべてのチャンネルに送信
                    for (const channelId of feed.channels) {
                        try {
                            const channel = await client.channels.fetch(channelId);
                            if (channel) {
                                // webhookを取得または作成
                                const webhook = await getWebhookInChannel(channel);
                                if (webhook) {
                                    await sendRssToWebhook(webhook, item, feed, faviconUrl, feedData.link);
                                    log.info(`チャンネル ${channelId} にアイテム "${item.title}" を送信しました`);
                                } else {
                                    log.error(`チャンネル ${channelId} のWebhook取得に失敗しました`);
                                }
                            }
                        } catch (channelError) {
                            log.error(`チャンネル ${channelId} へのメッセージ送信エラー: ${channelError.message}`);
                        }
                    }
                }

                // 最後に処理したアイテムの情報を更新
                if (newItems.length > 0) {
                    const lastItem = newItems[newItems.length - 1];
                    
                    // 保存前に内容を確認
                    log.debug(`保存するRSSステータス: ` +
                             `URL=${feed.url}, ` +
                             `lastItemId=${lastItem.guid || 'null'}, ` +
                             `lastPublishDate=${safeFormatDate(lastItem.pubDate)}, ` + 
                             `lastTitle=${lastItem.title || 'null'}`);
                    
                    await updateRssStatus(
                        feed.url,
                        lastItem.guid || null,
                        lastItem.pubDate || null,
                        lastItem.title || null
                    );
                    log.info(`フィード ${feed.url} のステータスを更新しました (最新アイテム: ${lastItem.title})`);
                } else {
                    log.info(`フィード ${feed.url} に新しいアイテムはありませんでした`);
                }

            } catch (error) {
                log.error(`フィード ${feed.name} (${feed.url}) の処理中にエラーが発生しました: ${error.message}`);
                if (error.stack) {
                    log.error(`スタックトレース: ${error.stack}`);
                }
            }
        }
    } catch (error) {
        log.error(`RSSフィード処理中にエラーが発生しました: ${error.message}`);
        if (error.stack) {
            log.error(`スタックトレース: ${error.stack}`);
        }
    }
}

// URLからドメインを抽出する関数
function extractDomain(url) {
    try {
        const urlObj = new URL(url);
        return urlObj.hostname;
    } catch (error) {
        return null;
    }
}

// RSSアイテムをWebhookに送信する関数 (ComponentsV2対応、SeparatorSpacingSize使用)
async function sendRssToWebhook(webhook, item, feed, faviconUrl, feedLink) {
    try {
        // 画像URLを取得
        const imageUrl = await getImageFromItem(item);

        // ContainerBuilderを使用して装飾
        const container = new ContainerBuilder();

        // ヘッダー: タイトルとサイト名
        const headerText = new TextDisplayBuilder().setContent(
            `## [${item.title}](${item.link})`
        );
        container.addTextDisplayComponents(headerText);

        // 区切り線 (SeparatorSpacingSize.Large)
        try {
            container.addSeparatorComponents(separator => {
                separator.setSpacing(SeparatorSpacingSize.Large);
                return separator;
            });
        } catch (separatorError) {
            log.error(`区切り線エラー: ${separatorError.message}`);
            // フォールバック: テキスト区切り
            container.addTextDisplayComponents(new TextDisplayBuilder().setContent('---'));
        }

        // 内容セクション
        if (item.contentSnippet) {
            // 内容が長い場合は切り詰める
            const description = item.contentSnippet.length > 500
                ? item.contentSnippet.substring(0, 500).trim() + '...'
                : item.contentSnippet.trim();
        
            const contentText = new TextDisplayBuilder().setContent(description);
            container.addTextDisplayComponents(contentText);
        }

        // 2つ目の区切り線
        try {
            container.addSeparatorComponents(separator => {
                separator.setSpacing(SeparatorSpacingSize.Large);
                return separator;
            });
        } catch (separatorError) {
            log.error(`区切り線エラー: ${separatorError.message}`);
            container.addTextDisplayComponents(new TextDisplayBuilder().setContent('---'));
        }

        // 画像の表示
        if (imageUrl) {
            try {
                container.addMediaGalleryComponents(
                    new MediaGalleryBuilder()
                        .addItems(
                            new MediaGalleryItemBuilder()
                                .setURL(imageUrl)
                        )
                );

            } catch (imageError) {
                log.error(`画像表示エラー: ${imageError.message}`);
            }
        }

        // 3つ目の区切り線
        try {
            container.addSeparatorComponents(separator => {
                separator.setSpacing(SeparatorSpacingSize.Large);
                return separator;
            });
        } catch (separatorError) {
            log.error(`区切り線エラー: ${separatorError.message}`);
            container.addTextDisplayComponents(new TextDisplayBuilder().setContent('---'));
        }

        // メタデータセクション
        const metaTextParts = [];

        // カテゴリ
        if (item.categories && item.categories.length > 0) {
            metaTextParts.push(`📁 **カテゴリ**: ${item.categories.join(', ')}`);
        }

        // 著者
        if (item.creator || item.author) {
            const author = item.creator || item.author;
            metaTextParts.push(`✍️ **著者**: ${author}`);
        }

        // 公開日時
        if (item.pubDate) {
            const pubDate = new Date(item.pubDate);
            const formattedDate = pubDate.toLocaleString('ja-JP', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                weekday: 'short'
            });

            metaTextParts.push(`📅 **公開日時**: ${formattedDate}`);
        }

        if (metaTextParts.length > 0) {
            const metaText = new TextDisplayBuilder().setContent(metaTextParts.join('\n'));
            container.addTextDisplayComponents(metaText);
        }

        // フッター
        const footerText = new TextDisplayBuilder().setContent(
            `-# RSS経由で自動配信されました`
        );
        container.addTextDisplayComponents(footerText);

        // 記事リンク用ボタン (一番下に配置)
        if (item.link) {
            // 記事リンクボタン
            const readArticleButton = new ButtonBuilder()
                .setLabel('記事を読む')
                .setURL(item.link)
                .setStyle(ButtonStyle.Link)
                .setEmoji('🔗');
    
                container.addActionRowComponents(row => {
                    row.addComponents(readArticleButton);
                    return row;
                });
        }

        // Webhookの送信オプション
        const webhookOptions = {
            username: feed.name,
            content: '',
            components: [container],
            flags: MessageFlags.IsComponentsV2
        };

        // アイコンURLがある場合は設定
        if (faviconUrl) {
            try {
                // ファビコンのURLが有効かチェック
                const faviconCheck = await axios.head(faviconUrl);
                if (faviconCheck.status === 200) {
                    // Content-Typeをチェック（画像形式であることを確認）
                    const contentType = faviconCheck.headers['content-type'];
                    if (contentType && contentType.startsWith('image/')) {
                        webhookOptions.avatarURL = faviconUrl;
                        log.info(`有効なファビコンを設定: ${faviconUrl}`);
                    } else {
                        log.warn(`無効なファビコン形式: ${contentType}`);
                        // Google Faviconサービスを代替として使用
                        const domain = extractDomain(feed.url) || extractDomain(feedLink);
                        webhookOptions.avatarURL = `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
                    }
                }
            } catch (faviconError) {
                log.error(`ファビコン検証エラー: ${faviconError.message}`);
                // エラー時は代替アイコンを使用
                const domain = extractDomain(feed.url) || extractDomain(feedLink);
                if (domain) {
                    webhookOptions.avatarURL = `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
                }
            }
        }

        // メッセージ送信
        await webhook.send(webhookOptions);

    } catch (error) {
        log.error(`RSSメッセージ作成/送信エラー: ${error.message}`);
        if (error.stack) {
            log.error(`スタックトレース: ${error.stack}`);
        }

        // エラー時のフォールバック: シンプルなメッセージ
        try {
            await webhook.send({
                username: feed.name,
                content: `**${item.title}**\n${item.link || ''}`,
            });
        } catch (fallbackError) {
            log.error(`フォールバックメッセージ送信エラー: ${fallbackError.message}`);
        }
    }
}

// RSSボットを起動する関数
export async function startRssBot(client) {
    log.info('RSSボットを起動します');

    try {
        // 初回のRSS処理を実行
        await processRssFeeds(client);

        // 定期実行のスケジュール設定 (10分ごとに実行)
        cron.schedule('*/10 * * * *', async () => {
            await processRssFeeds(client);
        });

        log.info('RSSボットが正常に起動しました');

        return true;
    } catch (error) {
        log.error(`RSSボット起動エラー: ${error.message}`);
        if (error.stack) {
            log.error(`スタックトレース: ${error.stack}`);
        }
        return false;
    }
}

// 単独実行用のコード
if (import.meta.url === `file://${process.argv[1]}`) {
    import('../config.mjs').then(async ({ getConfig }) => {
        try {
            // DiscordClientを作成
            const { Client, GatewayIntentBits } = await import('discord.js');
            const client = new Client({
                intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildWebhooks]
            });

            // ログイン
            await client.login(getConfig().token);
            log.info('Discord clientにログインしました');

            // ボットを起動
            await startRssBot(client);

        } catch (error) {
            log.error(`RSS単独実行エラー: ${error.message}`);
            if (error.stack) {
                log.error(`スタックトレース: ${error.stack}`);
            }
            process.exit(1);
        }
    });
}