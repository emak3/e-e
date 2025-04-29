import { 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle,
    ActionRowBuilder
} from "discord.js";
import log from "../../logger.mjs";
import { formatStudentInfo, createSelectMenu } from '../../utils/student-utils.mjs';
import { getStudentsFromSession } from '../../utils/student-session-manager.mjs';

// セレクトメニューのカスタムID
const MENU_CUSTOM_ID = 'student-display-mode';

/**
 * @param {import('discord.js').StringSelectMenuInteraction} interaction
 */
export default async function (interaction) {
    // 学生表示モードのメニューかチェック
    if (interaction.customId === MENU_CUSTOM_ID) {
        const displayMode = interaction.values[0];
        
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
        
        // カスタマイズモードの場合
        if (displayMode === 'custom') {
            // モーダルを表示してカスタムフォーマット入力
            const modal = new ModalBuilder()
                .setCustomId('student-format-modal')
                .setTitle('カスタム表示フォーマット');
            
            const formatInput = new TextInputBuilder()
                .setCustomId('format')
                .setLabel('表示フォーマット')
                .setStyle(TextInputStyle.Paragraph)
                .setPlaceholder('${number}番 ${firstName} ${lastName} (${furigana})')
                .setValue('${number}番 ${name} (${furigana})')
                .setRequired(true);
            
            const formatRow = new ActionRowBuilder().addComponents(formatInput);
            modal.addComponents(formatRow);
            
            // モーダルに学生データを含める方法はないため、
            // セッションからデータを取得する必要があります
            await interaction.showModal(modal);
            
            log.debug(`ユーザー ${interaction.user.tag} がカスタム表示フォーマットモーダルを表示しました`);
        } else {
            // 通常の表示モード
            const formattedText = formatStudentInfo(students, displayMode);
            
            // セレクトメニューを再作成
            const selectMenu = createSelectMenu();
            
            await interaction.update({
                content: formattedText,
                components: [selectMenu]
            });
            
            log.debug(`ユーザー ${interaction.user.tag} が表示モードを "${displayMode}" に変更しました`);
        }
    }
}