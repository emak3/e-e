const { BaseInteraction } = require("discord.js");
/**
 * @param {BaseInteraction} interaction
 */
module.exports = async function (interaction) {
    if (!interaction.isStringSelectMenu()
    ) return;
    for (const value of interaction.client.menus) {
        await value(interaction);
    }
}