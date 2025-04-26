import { BaseInteraction } from "discord.js";

/**
 * @param {BaseInteraction} interaction
 */
export default async function (interaction) {
    if (!interaction.isButton()) return;
    for (const value of interaction.client.buttons) {
        await value(interaction);
    }
}