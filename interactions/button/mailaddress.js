const { ButtonInteraction, ModalBuilder, TextInputBuilder, ActionRowBuilder, TextInputStyle, MessageFlags } = require("discord.js");
const log = require("../../logger.js");
const { getConfig } = require('../../config.js');
/**
 * @param {ButtonInteraction} interaction
 */
module.exports = async function (interaction) {
    if (interaction.customId === "mailad") {
        const role = interaction.guild.roles.cache.find(roles => roles.id === getConfig().verifyRoleId);
        if (interaction.member.roles.cache.has(role.id)) return await interaction.reply({ content: 'あなたはすでに認証済みです。', flags: MessageFlags.Ephemeral });
        
        const modal = new ModalBuilder()
            .setCustomId('emailModal')
            .setTitle('メールアドレス認証');

        const emailInput = new TextInputBuilder()
            .setCustomId('email')
            .setLabel('サレジオのメールアドレスを入力してください')
            .setValue('s＊＊＊＊＊@s.salesio-sp.ac.jp')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        const row = new ActionRowBuilder().addComponents(emailInput);
        modal.addComponents(row);
        await interaction.showModal(modal);
    }
}