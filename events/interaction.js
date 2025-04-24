const { Events, BaseInteraction } = require("discord.js");
module.exports = {
    name: Events.InteractionCreate,
    /**
     * @param {BaseInteraction} interaction
     */
    async execute(interaction) {
        for (const value of interaction.client.interactions) {
            if (typeof value === 'function') {
                await value(interaction);
            }
        }
    }
}