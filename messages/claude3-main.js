const { Message } = require("discord.js");
const { hanhanahan, getConfig } = require('../config.js');
const { handleSpecialChannelMessage } = require('./specialChannels');
const { Anthropic } = require('@anthropic-ai/sdk');
const claude = new Anthropic({ apiKey: getConfig().claudeApiKey });
const fetch = require('node-fetch');
const log = require("../logger.js");
const conversationHistory = {};

async function getBase64FromUrl(url) {
    try {
        const response = await fetch(url);
        const buffer = await response.buffer();
        return buffer.toString('base64');
    } catch (error) {
        log.error('Error fetching image:', error);
        return null;
    }
}
/**
 * @param {Message} message
 */
module.exports = async function (message) {
    // 会話履歴を保持するオブジェクト
    if (message.author.bot) return;
    // メッセージがスレッド内の場合、親チャンネルIDを取得
    const parentChannelId = message.channel.isThread() ? message.channel.parentId : message.channel.id;

    // 親チャンネルがchannelIdsに含まれているか、もしくは直接メッセージがチャンネルに送られているか確認
    if (getConfig().channelIds.includes(parentChannelId)) {
        const prompt = message.content.trim();
        const userId = message.author.id;

        if (prompt) {
            let thread = message.channel;

            // スレッド外のメッセージの場合、新しくスレッドを作成
            if (!message.channel.isThread()) {
                const threadName = prompt.substring(0, 10) || `${message.author.username} の会話`;
                thread = await message.startThread({
                    name: `${threadName}`,
                    autoArchiveDuration: 60, // スレッドが自動アーカイブされる時間を設定（ここでは60分）
                });
            }

            // 会話履歴にユーザーが過去に送ったメッセージを追加
            if (!conversationHistory[userId]) {
                conversationHistory[userId] = [];
            }

            // メッセージが返信かどうかをチェック
            if (message.reference) {
                conversationHistory[userId].push({ role: 'user', content: prompt });
            } else {
                conversationHistory[userId] = [{ role: 'user', content: prompt }];
            }

            if (message.attachments.size > 0) {
                const imageAttachments = [...message.attachments.values()].slice(0, 5);
                const imageMessages = [];

                for (const attachment of imageAttachments) {
                    const base64Image = await getBase64FromUrl(attachment.url);
                    if (base64Image) {
                        imageMessages.push({
                            "type": "image",
                            "source": {
                                "type": "base64",
                                "media_type": attachment.contentType,
                                "data": base64Image,
                            },
                        });
                    }
                }

                const messagesToSend = [
                    ...imageMessages,
                    {
                        "type": "text",
                        "text": prompt ? prompt : "これらのイメージを描写してください。",
                    },
                ];

                const loadingMessage = await thread.send('🤔 生成中...');

                try {
                    const stream = claude.messages.stream({
                        system: getConfig().systemPlan,
                        messages: [{ "role": "user", "content": messagesToSend }],
                        model: getConfig().nlModel,
                        max_tokens: 400,
                    });

                    const response = await stream.finalMessage();
                    const generatedContent = response.content[0].text;

                    await loadingMessage.edit(generatedContent);

                    conversationHistory[userId].push({ role: 'assistant', content: generatedContent });

                } catch (error) {
                    log.error('Error generating response:', error);
                    await loadingMessage.edit('回答の生成中にエラーが発生しました。```'+ error.message+'```');
                }
            } else if (message.content) {
                const loadingMessage = await thread.send('🤔 生成中...');

                try {
                    const stream = claude.messages.stream({
                        system: getConfig().systemPlan,
                        messages: conversationHistory[userId],
                        model: getConfig().nlModel,
                        max_tokens: 400,
                    });

                    const response = await stream.finalMessage();
                    const generatedContent = response.content[0].text;

                    await loadingMessage.edit(generatedContent);

                    conversationHistory[userId].push({ role: 'assistant', content: generatedContent });

                } catch (error) {
                    log.error('Error generating response:', error);
                    await loadingMessage.edit('回答の生成中にエラーが発生しました。```'+ error.message+'```');
                }
            }
        }
    } else {
        // 特定のチャンネルの場合、specialChannels.jsの処理を呼び出す
        await handleSpecialChannelMessage(message);

        await hanhanahan(message);
    }
}