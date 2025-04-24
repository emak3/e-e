const { BaseInteraction, MessageFlags } = require("discord.js");
/**
 * @param {BaseInteraction} interaction
 */
module.exports = async function (interaction) {
    if (!interaction.isCommand()) return;
    if (interaction.client.commands.has(interaction.commandName)) {
        interaction.client.commands.get(interaction.commandName).execute(interaction);
    } else {
        await interaction.reply({ content: "コマンドが存在しない又は、エラーの可能性があります。", flags: MessageFlags.Ephemeral });
    }
}