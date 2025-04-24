const { Client, Partials, GatewayIntentBits } = require("discord.js");
const { getConfig } = require('./config.js');
const log = require("./logger.js");
const { readdirSync } = require("node:fs");
require("./utils/newUsernameSystem")
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

for (const file of readdirSync("./events").filter((file) =>
    file.endsWith(".js"),
)) {
    const event = require(`./events/${file}`);
    if (event.once) {
        client.once(event.name, async (...args) => await event.execute(...args));
    }
    else {
        client.on(event.name, async (...args) => await event.execute(...args));
    }
}
for (const file of readdirSync("./commands").filter((file) =>
    file.endsWith(".js"),
)) {
    const command = require(`./commands/${file}`);
    client.commands.set(command.command.name, command);
}
for (const file of readdirSync("./interactions").filter((file) =>
    file.endsWith(".js"),
)) {
    const interaction = require(`./interactions/${file}`);
    client.interactions.push(interaction);
}
for (const file of readdirSync("./interactions/modal").filter((file) =>
    file.endsWith(".js"),
)) {
    const modal = require(`./interactions/modal/${file}`);
    client.modals.push(modal);
}
for (const file of readdirSync("./interactions/button").filter((file) =>
    file.endsWith(".js"),
)) {
    const button = require(`./interactions/button/${file}`);
    client.buttons.push(button);
}
for (const file of readdirSync("./interactions/menu").filter((file) =>
    file.endsWith(".js"),
)) {
    const menu = require(`./interactions/menu/${file}`);
    client.menus.push(menu);
}
for (const file of readdirSync("./messages").filter((file) =>
    file.endsWith(".js"),
)) {
    const message = require(`./messages/${file}`);
    client.messages.push(message);
}

client.login(getConfig().token).then(log.info(getConfig()));