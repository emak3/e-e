const { ButtonInteraction, ModalBuilder, TextInputBuilder, ActionRowBuilder, TextInputStyle, MessageFlags } = require("discord.js");
const log = require("../../logger.js");
const { getConfig } = require('../../config.js');
/**
 * @param {ButtonInteraction} interaction
 */
module.exports = async function (interaction) {
    if (interaction.customId === "vcode") {
        const role = interaction.guild.roles.cache.find(roles => roles.id === getConfig().verifyRoleId);
        if (interaction.member.roles.cache.has(role.id)) return await interaction.reply({ content: 'あなたはすでに認証済みです。', flags: MessageFlags.Ephemeral });
        // 認証コード入力モーダル表示
        const codeModal = new ModalBuilder()
            .setCustomId('codeModal')
            .setTitle('認証コードの入力');

        const codeInput = new TextInputBuilder()
            .setCustomId('code')
            .setLabel('メールに届いた認証コードを入力してください')
            .setMaxLength(6)
	        .setMinLength(6)
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        const row = new ActionRowBuilder().addComponents(codeInput);
        codeModal.addComponents(row);

        await interaction.showModal(codeModal);
    }
}