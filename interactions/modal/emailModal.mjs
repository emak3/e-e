import { InteractionType, MessageFlags } from "discord.js";
import { sendVerificationEmail } from '../../email/mailer.mjs';
import { getConfig } from '../../config.mjs';
import { saveEmail } from '../../utils/email-database.mjs'; // Admin SDK版を使用
import log from "../../logger.mjs";

// 認証コード待ちユーザーをメモリに保存
const pendingVerifications = new Map();

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
                log.error(`メール送信エラー: ${err.message}`);
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
                    // メンバーにロールを付与
                    const member = await interaction.guild.members.fetch(userId);
                    await member.roles.add(role);
                    
                    // Admin SDKを使用してFirestoreにメールアドレスを保存
                    try {
                        await saveEmail(userId, data.email);
                        log.info(`ユーザー ${interaction.user.tag} のメールアドレスを保存しました: ${data.email}`);
                    } catch (dbError) {
                        // データベースエラーはログに記録するが、ユーザーには成功を返す
                        log.error(`データベース保存エラー: ${dbError.message}`);
                        log.error(`対象: ユーザーID=${userId}, メール=${data.email}`);
                        if (dbError.stack) {
                            log.error(`スタックトレース: ${dbError.stack}`);
                        }
                    }
                    
                    // 認証コード情報を削除
                    pendingVerifications.delete(userId);
                    
                    log.info(`ユーザー ${interaction.user.tag} の認証が成功しました。メールアドレス: ${data.email}`);
                    await interaction.reply({ content: '認証成功！ロールを付与しました。', flags: MessageFlags.Ephemeral });
                } catch (error) {
                    log.error(`ロール付与エラー: ${error.message}`);
                    if (error.stack) {
                        log.error(`スタックトレース: ${error.stack}`);
                    }
                    await interaction.reply({ content: 'ロールの付与中にエラーが発生しました。管理者に連絡してください。', flags: MessageFlags.Ephemeral });
                }
            } else {
                await interaction.reply({ content: '認証コードが一致しません。', flags: MessageFlags.Ephemeral });
            }
        }
    }
}