import { SlashCommandBuilder, InteractionContextType, MessageFlags } from 'discord.js';
import log from "../logger.mjs";
import fs from "node:fs";
import path from 'path';
import { fileURLToPath } from 'url';
import { getConfig } from '../config.mjs';

// __dirname の代わりに使用
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default {
    command: new SlashCommandBuilder()
        .setName("mailaddress")
        .setDescription("メールアドレス確認用")
        .addUserOption(option =>
            option
                .setName('member')
                .setDescription('メールアドレスを確認したいメンバー')
                .setRequired(true))
                .setContexts(InteractionContextType.Guild),

    /**
     * @param {import('discord.js').ChatInputCommandInteraction} interaction
     */
    async execute(interaction) {
        // データベースファイルのパス
        const EMAIL_DB_PATH = path.join(__dirname, '../data/email-database.json');

        // データベースディレクトリの存在確認、なければ作成
        const dbDir = path.dirname(EMAIL_DB_PATH);
        if (!fs.existsSync(dbDir)) {
            try {
                fs.mkdirSync(dbDir, { recursive: true });
                log.info('データベースディレクトリを作成しました');
            } catch (error) {
                log.error('ディレクトリ作成エラー:', error);
                await interaction.reply({ 
                    content: 'エラーが発生しました。管理者に連絡してください。', 
                    flags: MessageFlags.Ephemeral 
                });
                return;
            }
        }

        // メールアドレスデータベースの読み込み
        let emailDatabase = {};
        try {
            if (fs.existsSync(EMAIL_DB_PATH)) {
                const data = fs.readFileSync(EMAIL_DB_PATH, 'utf-8');
                emailDatabase = JSON.parse(data);
                log.info('データベースを読み込みました');
            } else {
                // ファイルが存在しない場合は新規作成
                fs.writeFileSync(EMAIL_DB_PATH, JSON.stringify({}, null, 2));
                log.info('新しいデータベースファイルを作成しました');
            }
        } catch (error) {
            log.error('データベースの読み込みエラー:', error);
            await interaction.reply({ 
                content: 'データベースの読み込みに失敗しました。管理者に連絡してください。', 
                flags: MessageFlags.Ephemeral 
            });
            return;
        }

        // 指定されたユーザーの取得
        const user = interaction.options.getUser('member');
        
        if (!user) {
            await interaction.reply({ 
                content: 'ユーザーが見つかりませんでした。', 
                flags: MessageFlags.Ephemeral 
            });
            return;
        }
        
        const userId = user.id;

        // メールアドレスの確認と返答
        if (emailDatabase[userId]) {
            await interaction.reply({ 
                content: `${user.toString()} のメールアドレス: ${emailDatabase[userId]}`, 
                flags: MessageFlags.Ephemeral 
            });
            log.info(`ユーザー ${interaction.user.tag} が ${user.tag} のメールアドレスを確認しました`);
        } else {
            await interaction.reply({ 
                content: `${user.toString()} はデータ登録されていません。`, 
                flags: MessageFlags.Ephemeral 
            });
        }
    }
}