import { Client, Partials, GatewayIntentBits } from "discord.js";
import { getConfig } from './config.mjs';
import log from "./logger.mjs";
import { readdirSync } from "node:fs";
import "./utils/newUsernameSystem.mjs";
const client = new Client({ intents: Object.values(GatewayIntentBits), allowedMentions: { parse: ["users", "roles"] }, partials: [Partials.Message, Partials.Channel, Partials.Reaction] });

client.commands = new Map();
client.interactions = [];
client.messages = [];
client.modals = [];
client.buttons = [];
client.menus = [];

process.on("uncaughtException", (error) => {
    console.error(error);
});

// ファイルの動的インポートを使用
for (const file of readdirSync("./events").filter((file) =>
    file.endsWith(".mjs"),
)) {
    const eventModule = await import(`./events/${file}`);
    const event = eventModule.default;
    if (event.once) {
        client.once(event.name, async (...args) => await event.execute(...args));
    }
    else {
        client.on(event.name, async (...args) => await event.execute(...args));
    }
}

for (const file of readdirSync("./commands").filter((file) =>
    file.endsWith(".mjs"),
)) {
    const commandModule = await import(`./commands/${file}`);
    const command = commandModule.default;
    client.commands.set(command.command.name, command);
}

for (const file of readdirSync("./interactions").filter((file) =>
    file.endsWith(".mjs"),
)) {
    const interactionModule = await import(`./interactions/${file}`);
    const interaction = interactionModule.default;
    client.interactions.push(interaction);
}

for (const file of readdirSync("./interactions/modal").filter((file) =>
    file.endsWith(".mjs"),
)) {
    const modalModule = await import(`./interactions/modal/${file}`);
    const modal = modalModule.default;
    client.modals.push(modal);
}

for (const file of readdirSync("./interactions/button").filter((file) =>
    file.endsWith(".mjs"),
)) {
    const buttonModule = await import(`./interactions/button/${file}`);
    const button = buttonModule.default;
    client.buttons.push(button);
}

for (const file of readdirSync("./interactions/menu").filter((file) =>
    file.endsWith(".mjs"),
)) {
    const menuModule = await import(`./interactions/menu/${file}`);
    const menu = menuModule.default;
    client.menus.push(menu);
}

for (const file of readdirSync("./messages").filter((file) =>
    file.endsWith(".mjs"),
)) {
    const messageModule = await import(`./messages/${file}`);
    const message = messageModule.default;
    client.messages.push(message);
}

client.login(getConfig().token).then(() => log.info(getConfig()));