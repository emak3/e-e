import { InteractionType, MessageFlags } from "discord.js";
import { sendVerificationEmail } from '../../email/mailer.mjs';
import { getConfig } from '../../config.mjs';
import fs from "node:fs";
import path from 'path';
import { fileURLToPath } from 'url';
import nodemailer from 'nodemailer';
import log from "../../logger.mjs";

// __dirname の代わりに使用
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const pendingVerifications = new Map();
/**
 * @param {ModalSubmitInteraction} interaction
 */

const EMAIL_DB_PATH = path.join(__dirname, '../../data/email-database.json');

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
}

// データベースを保存する関数
function saveDatabase() {
  try {
    fs.writeFileSync(EMAIL_DB_PATH, JSON.stringify(emailDatabase, null, 2));
    log.info('データベースを保存しました');
  } catch (error) {
    log.error('データベースの保存エラー:', error);
  }
}

export default async function (interaction) {
    if (interaction.type === InteractionType.ModalSubmit) {
        if (interaction.customId === 'emailModal') {
            const email = interaction.fields.getTextInputValue('email');
            // 正規表現: sで始まり、5桁の数字、@s.salesio-sp.ac.jp で終わる
            const emailPattern = /^s\d{5}@s\.salesio-sp\.ac\.jp$/;

            if (!emailPattern.test(email)) {
                await interaction.reply({
                    content: '正しい形式の学内メールアドレスを入力してください（例: `s23300@s.salesio-sp.ac.jp` ）',
                    flags: MessageFlags.Ephemeral,
                });
                return;
            }
            log.info(`ユーザー ${interaction.user.tag} がメールアドレス ${email} を入力しました`);
            const code = Math.floor(100000 + Math.random() * 900000).toString(); // 6桁コード
            pendingVerifications.set(interaction.user.id, { email, code });

            try {
                await sendVerificationEmail(email, code);
                await interaction.reply({ content: `認証コードを **${email}** に送信しました！\n迷惑メールフォルダーに入っている場合があります。`, flags: MessageFlags.Ephemeral });
            } catch (err) {
                console.error(err);
                await interaction.reply({ content: 'メール送信に失敗しました。', flags: MessageFlags.Ephemeral });
            }
        }

        if (interaction.customId === 'codeModal') {
            const inputCode = interaction.fields.getTextInputValue('code');
            const userId = interaction.user.id;
            const data = pendingVerifications.get(userId);

            if (!data) {
                return interaction.reply({ content: '認証情報が見つかりません。もう一度やり直してください。', flags: MessageFlags.Ephemeral });
            }

            if (inputCode === data.code) {
                const role = interaction.guild.roles.cache.find(r => r.id === getConfig().verifyRoleId);
                if (!role) {
                    return interaction.reply({ content: 'ロールが見つかりません。管理者に連絡してください。', flags: MessageFlags.Ephemeral });
                }

                try {
                    const member = await interaction.guild.members.fetch(userId);
                    await member.roles.add(role);
                    
                    // メールアドレスをデータベースに保存 - 修正: data.emailを使用
                    emailDatabase[userId] = data.email;
                    saveDatabase();
                    
                    pendingVerifications.delete(userId);
                    log.info(`ユーザー ${interaction.user.tag} の認証が成功しました。メールアドレス: ${data.email}`);
                    await interaction.reply({ content: '認証成功！ロールを付与しました。', flags: MessageFlags.Ephemeral });
                } catch (error) {
                    log.error(`ロール付与エラー: ${error}`);
                    await interaction.reply({ content: 'ロールの付与中にエラーが発生しました。管理者に連絡してください。', flags: MessageFlags.Ephemeral });
                }
            } else {
                await interaction.reply({ content: '認証コードが一致しません。', flags: MessageFlags.Ephemeral });
            }
        }
    }
}