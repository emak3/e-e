import { InteractionType } from "discord.js";
import log from "../../logger.mjs";
import { formatStudentInfo, createSelectMenu } from '../../utils/student-utils.mjs';
import { getStudentsFromSession } from '../../utils/student-session-manager.mjs';

/**
 * @param {import('discord.js').ModalSubmitInteraction} interaction
 */
export default async function (interaction) {
    if (interaction.type === InteractionType.ModalSubmit) {
        if (interaction.customId === 'student-format-modal') {
            try {
                // カスタムフォーマットを取得
                const customFormat = interaction.fields.getTextInputValue('format');
                
                // セッションから学生データを取得
                const messageId = interaction.message.id;
                const userId = interaction.user.id;
                const students = getStudentsFromSession(messageId, userId);
                
                // 学生データが取得できなかった場合
                if (!students || students.length === 0) {
                    await interaction.update({
                        content: 'セッションの有効期限が切れたか、データにアクセスできません。もう一度検索コマンドを実行してください。',
                        components: []
                    });
                    return;
                }
                
                // カスタムフォーマットで表示
                const formattedText = formatStudentInfo(students, 'custom', customFormat);
                
                // セレクトメニューを再作成
                const selectMenu = createSelectMenu();
                
                await interaction.update({
                    content: formattedText,
                    components: [selectMenu]
                });
                
                log.info(`ユーザー ${interaction.user.tag} がカスタム表示フォーマット "${customFormat}" を使用しました`);
            } catch (error) {
                log.error('カスタムフォーマット処理エラー:', error);
                await interaction.update({
                    content: 'エラー: カスタムフォーマットの処理中にエラーが発生しました。もう一度検索コマンドを実行してください。',
                    components: []
                });
            }
        }
    }
}