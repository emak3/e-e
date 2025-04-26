import { Message, EmbedBuilder, PermissionFlagsBits, ChannelType, AttachmentBuilder, StickerFormatType } from "discord.js";
import getWebhookInChannel from "../utils/webhookGet.mjs";
import log from "../logger.mjs";

/**
 * @param {Message} message
 */
export default async function (message) {
    if (message.channel.type === ChannelType.GuildCategory || message.channel.isDMBased() || message.author.bot) return;
    const threadId = message.channel.isThread() ? message.channel.id : null;
    if (!message.guild.members.me.permissions.has(PermissionFlagsBits.ManageWebhooks)) return;
    if (message.content.match(/https?:\/\/(canary\.|ptb\.)?discord(app)?\.com\/channels\/\d*\/\d*\/\d*(|\/)/)) {
        const url = message.content.match(
            /(http|https):\/\/(|canary\.|ptb\.)dis(cord|cordapp)\.com\/channels\/\d*\/\d*\/\d*(|\/)/
        )[0].replace(
            /(http|https):\/\/(|canary\.|ptb\.)dis(cord|cordapp)\.com\/channels\//,
            ""
        ).split("/", 3);
        const guild = message.client.guilds.cache.get(url[0]);
        const channel = guild.channels.cache.get(url[1]);

        if (!guild || !channel) return;
        try {
            const webhook = await getWebhookInChannel(message.channel);
            const msg = await channel.messages.fetch(url[2]);
            const embeds = [...msg.embeds];
            const components = [...msg.components]
            // TypeError: this.media.toJSON is not a function
            //log.debug(embeds)
            /*
            [
                Embed {
                    data: {
                       type: 'rich',
                       description: 'No tracks have been playing for the past 3 minutes, leaving :wave:\n' +
                            '\n' +
                           'This can be disabled by using the **[premium](https://www.patreon.com/Jockie)** command `24/7`, for more information check out the `perks` command!',
                        color: 16711680,
                        content_scan_version: 0
                    }
                }
            ]
            */
            //log.info(components)
            /*
            [
                ContainerComponent {
                    data: { type: 17, id: 1, accent_color: null, spoiler: false },
                        components: [
                            [TextDisplayComponent],
                            [SeparatorComponent],
                            [TextDisplayComponent],
                            [SeparatorComponent],
                            [MediaGalleryComponent],
                            [SeparatorComponent],
                            [TextDisplayComponent],
                            [TextDisplayComponent],
                            [ActionRow]
                        ]
                }
            ]
            */
            if (msg.stickers.size > 0) {
                embeds.pop();
                if (msg.stickers.first().format === StickerFormatType.Lottie) {
                    embeds.push(new EmbedBuilder()
                        .setColor(0x313338)
                        .setDescription(
                            "対応していないスタンプのため、表示できません。"
                        ));
                } else {
                    embeds.push(new EmbedBuilder()
                        .setTitle("スタンプ")
                        .setColor(0x313338)
                        .setImage(msg.stickers.first().url));
                }
            }
            if (msg.author.discriminator === "0000") {
                webhook.send({
                    content: msg.content || null,
                    username: msg.author.username,
                    avatarURL: msg.author.displayAvatarURL(),
                    embeds,
                    components,
                    allowedMentions: { parse: [] },
                    flags: 4096,
                    files:
                        msg.attachments.size > 0
                            ? msg.attachments.map((attachment) => {
                                if (attachment.spoiler) {
                                    return new AttachmentBuilder(attachment.url, {
                                        spoiler: true,
                                    });
                                } else {
                                    return attachment.url;
                                }
                            })
                            : [],
                    threadId: threadId
                })
                    .catch((e) => log.error(e));
            } else {
                webhook.send({
                    content: msg.content || null,
                    username: msg.guild.members.cache.get(msg.author.id).nickname ? `${msg.guild.members.cache.get(msg.author.id).nickname}` : msg.author.globalName ? `${msg.author.globalName}` : msg.author.username,
                    avatarURL: msg.member.displayAvatarURL({ dynamic: true }),
                    embeds,
                    components,
                    allowedMentions: { parse: [] },
                    flags: 4096,
                    files:
                        msg.attachments.size > 0
                            ? msg.attachments.map((attachment) => {
                                if (attachment.spoiler) {
                                    return new AttachmentBuilder(attachment.url, {
                                        spoiler: true,
                                    });
                                } else {
                                    return attachment.url;
                                }
                            })
                            : [],
                    threadId: threadId
                })
                    .catch((e) => log.error(e));
            }
        } catch (e) {
            return;
        }
    }
}