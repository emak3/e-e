import { Client, Partials, GatewayIntentBits, Events } from "discord.js";
import { getConfig } from './config.mjs';
import log from "./logger.mjs";
import { readdirSync } from "node:fs";
import "./utils/newUsernameSystem.mjs";
import { startRssBot } from "./modules/rss-bot.mjs";

// メインのクライアント初期化（元のindex.mjsと同様）
const client = new Client({ 
    intents: [
        ...Object.values(GatewayIntentBits),
        GatewayIntentBits.GuildWebhooks  // Webhooks用に追加
    ], 
    allowedMentions: { parse: ["users", "roles"] }, 
    partials: [Partials.Message, Partials.Channel, Partials.Reaction] 
});

client.commands = new Map();
client.interactions = [];
client.messages = [];
client.modals = [];
client.buttons = [];
client.menus = [];

process.on("uncaughtException", (error) => {
    console.error(error);
});

// ファイルの動的インポート（元のindex.mjsと同様）
async function loadComponents() {
    // イベントの読み込み
    for (const file of readdirSync("./events").filter((file) =>
        file.endsWith(".mjs"),
    )) {
        const eventModule = await import(`./events/${file}`);
        const event = eventModule.default;
        if (event.once) {
            client.once(event.name, async (...args) => await event.execute(...args));
        }
        else {
            client.on(event.name, async (...args) => await event.execute(...args));
        }
    }

    // コマンドの読み込み
    for (const file of readdirSync("./commands").filter((file) =>
        file.endsWith(".mjs"),
    )) {
        const commandModule = await import(`./commands/${file}`);
        const command = commandModule.default;
        client.commands.set(command.command.name, command);
    }

    // インタラクションの読み込み
    for (const file of readdirSync("./interactions").filter((file) =>
        file.endsWith(".mjs"),
    )) {
        const interactionModule = await import(`./interactions/${file}`);
        const interaction = interactionModule.default;
        client.interactions.push(interaction);
    }

    // モーダルの読み込み
    for (const file of readdirSync("./interactions/modal").filter((file) =>
        file.endsWith(".mjs"),
    )) {
        const modalModule = await import(`./interactions/modal/${file}`);
        const modal = modalModule.default;
        client.modals.push(modal);
    }

    // ボタンの読み込み
    for (const file of readdirSync("./interactions/button").filter((file) =>
        file.endsWith(".mjs"),
    )) {
        const buttonModule = await import(`./interactions/button/${file}`);
        const button = buttonModule.default;
        client.buttons.push(button);
    }

    // メニューの読み込み
    for (const file of readdirSync("./interactions/menu").filter((file) =>
        file.endsWith(".mjs"),
    )) {
        const menuModule = await import(`./interactions/menu/${file}`);
        const menu = menuModule.default;
        client.menus.push(menu);
    }

    // メッセージの読み込み
    for (const file of readdirSync("./messages").filter((file) =>
        file.endsWith(".mjs"),
    )) {
        const messageModule = await import(`./messages/${file}`);
        const message = messageModule.default;
        client.messages.push(message);
    }
}

// RSSボットとメインボットを起動する関数
async function startBots() {
    try {
        // コンポーネントを読み込み
        await loadComponents();
        
        // メインのボットを起動
        await client.login(getConfig().token);
        log.info('メインボットが起動しました');
        
        // メインボットの準備完了時にRSSボットも起動
        client.once(Events.ClientReady, async () => {
            log.info(`メインボット: ${client.user.tag} としてログインしました`);
            
            // RSSボットを起動（同じクライアントインスタンスを使用）
            try {
                await startRssBot(client);
                log.info('Webhook対応RSSボットの機能が有効化されました');
            } catch (error) {
                log.error('RSSボットの起動に失敗しました:', error);
            }
        });
    } catch (error) {
        log.error('ボットの起動に失敗しました:', error);
        process.exit(1);
    }
}

// ボットを起動
startBots();