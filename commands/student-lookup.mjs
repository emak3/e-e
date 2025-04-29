import { 
    SlashCommandBuilder, 
    InteractionContextType, 
    MessageFlags,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder
} from 'discord.js';
import log from "../logger.mjs";
import fs from "node:fs";
import path from 'path';
import { fileURLToPath } from 'url';
import { loadStudentData, findStudentsByNumbers, formatStudentInfo, createSelectMenu } from '../utils/student-utils.mjs';
import { createOrUpdateSession } from '../utils/student-session-manager.mjs';

// __dirname の代わりに使用
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default {
    command: new SlashCommandBuilder()
        .setName("student-lookup")
        .setDescription("学生番号から学生情報を検索")
        .addStringOption(option =>
            option
                .setName('numbers')
                .setDescription('調べたい学生番号（複数可、カンマ区切り）')
                .setRequired(true))
        .setContexts(InteractionContextType.Guild),

    /**
     * @param {import('discord.js').ChatInputCommandInteraction} interaction
     */
    async execute(interaction) {
        // 学生データファイルのパス
        const STUDENT_DATA_PATH = path.join(__dirname, '../data/student-data.json');

        // データディレクトリの存在確認
        const dbDir = path.dirname(STUDENT_DATA_PATH);
        if (!fs.existsSync(dbDir)) {
            try {
                fs.mkdirSync(dbDir, { recursive: true });
                log.info('データディレクトリを作成しました');
            } catch (error) {
                log.error('ディレクトリ作成エラー:', error);
                await interaction.reply({ 
                    content: 'エラーが発生しました。管理者に連絡してください。', 
                    flags: MessageFlags.Ephemeral 
                });
                return;
            }
        }

        // 学生データの読み込み
        const studentData = await loadStudentData(STUDENT_DATA_PATH);
        if (!studentData) {
            await interaction.reply({ 
                content: '学生データの読み込みに失敗しました。管理者に連絡してください。', 
                flags: MessageFlags.Ephemeral 
            });
            return;
        }

        // 入力された学生番号を取得して整形（カンマまたはスペースで区切られた複数の番号に対応）
        const numbersInput = interaction.options.getString('numbers').trim();
        const numbersRaw = numbersInput.split(/[,\s]+/);
        
        // 学生情報の検索
        const foundStudents = findStudentsByNumbers(studentData, numbersRaw);
        
        // 検索結果がない場合
        if (foundStudents.length === 0) {
            await interaction.reply({ 
                content: '指定された学生番号が見つかりませんでした。', 
                flags: MessageFlags.Ephemeral 
            });
            return;
        }
        
        // 最初の表示（デフォルト: 学生番号、名前、フリガナを表示）
        const initialDisplay = formatStudentInfo(foundStudents, 'default');
        
        // セレクトメニューの作成
        const selectMenu = createSelectMenu();
        
        try {
            // 結果とメニューを送信
            const reply = await interaction.reply({
                content: initialDisplay,
                components: [selectMenu],
                flags: MessageFlags.Ephemeral,
                fetchReply: true // 返信メッセージを取得するために必要
            });
            
            // セッション情報を作成
            const messageId = reply.id;
            const userId = interaction.user.id;
            createOrUpdateSession(messageId, userId, foundStudents);
            
            log.info(`ユーザー ${interaction.user.tag} が学生番号 ${numbersRaw.join(', ')} を検索し、セッションを作成しました`);
        } catch (error) {
            log.error('返信またはセッション作成エラー:', error);
            await interaction.followUp({
                content: '検索結果の表示中にエラーが発生しました。',
                flags: MessageFlags.Ephemeral
            }).catch(() => {});
        }
    }
};