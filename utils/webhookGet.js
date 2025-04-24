module.exports = async function getWebhookInChannel(channel) {
    var _a;
    const webhookMaps = new Map();
    const webhook = (_a = webhookMaps.get(channel.id)) !== null && _a !== void 0 ? _a : (await getWebhook(webhookMaps, channel));
    return webhook;
}
async function getWebhook(webhookMaps, channel) {
    var _a, _b;
    if (channel.isThread()) {
        if (channel.parent) {
            const webhooks = await channel.parent.fetchWebhooks();
            const webhook = (_a = webhooks.find((v) => v === null || v === void 0 ? void 0 : v.token)) !== null && _a !== void 0 ? _a : (await channel.parent.createWebhook({ name: "便所" }));
            if (webhook)
                webhookMaps.set(channel.id, webhook);
            return webhook;
        }
        else {
            return undefined;
        }
    }
    else {
        const webhooks = await channel.fetchWebhooks();
        const webhook = (_b = webhooks.find((v) => v.token)) !== null && _b !== void 0 ? _b : (await channel.createWebhook({ name: "便所" }));
        if (webhook)
            webhookMaps.set(channel.id, webhook);
        return webhook;
    }
}