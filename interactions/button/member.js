const { ButtonInteraction, EmbedBuilder, MessageFlags } = require("discord.js");
const log = require("../../logger.js");
const fs = require("node:fs");
const path = require('path');
const { getConfig } = require('../../config.js');
/**
 * @param {ButtonInteraction} interaction
 */
module.exports = async function (interaction) {
    if (interaction.customId === "member") {
        // 学生データファイルのパス
        const STUDENT_DATA_PATH = path.join(__dirname, '../../data/student-data.json');
        // データベースファイルのパス
        const EMAIL_DB_PATH = path.join(__dirname, '../../data/email-database.json');

        // データディレクトリの存在確認、なければ作成
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
        let studentData = {};
        try {
            if (fs.existsSync(STUDENT_DATA_PATH)) {
                const data = fs.readFileSync(STUDENT_DATA_PATH, 'utf-8');
                studentData = JSON.parse(data);
                log.info('学生データを読み込みました');
            } else {
                log.info('学生データファイルが存在しません。');
                await interaction.reply({ 
                    content: '学生データファイルが見つかりません。管理者に連絡してください。', 
                    flags: MessageFlags.Ephemeral 
                });
                return;
            }
        } catch (error) {
            log.error('学生データの読み込みエラー:', error);
            await interaction.reply({ 
                content: '学生データの読み込みに失敗しました。管理者に連絡してください。', 
                flags: MessageFlags.Ephemeral 
            });
            return;
        }

        // メールアドレスデータベースの読み込み
        let emailDatabase = {};
        try {
            if (fs.existsSync(EMAIL_DB_PATH)) {
                const data = fs.readFileSync(EMAIL_DB_PATH, 'utf-8');
                emailDatabase = JSON.parse(data);
                log.info('メールデータベースを読み込みました');
            } else {
                // ファイルが存在しない場合は新規作成
                fs.writeFileSync(EMAIL_DB_PATH, JSON.stringify({}, null, 2));
                log.info('新しいメールデータベースファイルを作成しました');
            }
        } catch (error) {
            log.error('メールデータベースの読み込みエラー:', error);
            await interaction.reply({ 
                content: 'メールデータベースの読み込みに失敗しました。管理者に連絡してください。', 
                flags: MessageFlags.Ephemeral 
            });
            return;
        }

        // サーバーメンバーを取得
        const guild = interaction.guild;
        const members = await guild.members.fetch();
        
        // メールアドレスからDiscord IDを見つけるための逆マッピング
        const emailToUserIdMap = {};
        Object.entries(emailDatabase).forEach(([userId, email]) => {
            emailToUserIdMap[email] = userId;
        });
        
        // 学生情報とメンバー情報を結合（抹消された学生を除外）
        const studentEntries = Object.entries(studentData).filter(([_, data]) => data[0] !== "[抹消]");
        
        // 番号でソート（01, 02, ...の順に）
        studentEntries.sort((a, b) => {
            return a[0].localeCompare(b[0], undefined, { numeric: true });
        });
        
        // 埋め込みを作成
        const embeds = [];
        const STUDENTS_PER_EMBED = 30; // 1つの埋め込みに表示する学生数
        
        for (let i = 0; i < studentEntries.length; i += STUDENTS_PER_EMBED) {
            const embed = new EmbedBuilder()
                .setTitle('クラスメンバー一覧')
                .setColor(0x0099FF)
                .setTimestamp();
            
            if (i === 0) {
                embed.setDescription('出席番号順の学生リスト');
            } else {
                embed.setDescription(`出席番号順の学生リスト (続き)`);
            }
            
            const chunk = studentEntries.slice(i, i + STUDENTS_PER_EMBED);
            
            chunk.forEach(([number, data]) => {
                const name = data[0];
                const furigana = data[1];
                
                // メールアドレス作成
                const email = `s233${number}@s.salesio-sp.ac.jp`;
                
                // ステータス（メンション）作成
                let status = "未登録";
                const userId = emailToUserIdMap[email];
                if (userId) {
                    const member = members.get(userId);
                    if (member) {
                        status = `<@${userId}>`;
                    }
                }
                
                // フィールドとして追加
                embed.addFields({
                    name: `${number}. ${name} (${furigana})`,
                    value: `**メール**: ${email}\n**ステータス**: ${status}`,
                    inline: false
                });
            });
            
            embeds.push(embed);
        }
        
        // 埋め込みがない場合（すべての学生が抹消されている場合）
        if (embeds.length === 0) {
            await interaction.reply({ 
                content: '表示できる学生データがありません。', 
                flags: MessageFlags.Ephemeral 
            });
            return;
        }
        
        // 最初の埋め込みを送信
        await interaction.reply({ 
            embeds: [embeds[0]], 
            flags: MessageFlags.Ephemeral 
        });
        
        // 追加の埋め込みがあれば送信
        for (let i = 1; i < embeds.length; i++) {
            await interaction.followUp({
                embeds: [embeds[i]],
                flags: MessageFlags.Ephemeral
            });
        }
        
        log.info(`ユーザー ${interaction.user.tag} がクラスメンバー一覧を表示しました`);
    }
}