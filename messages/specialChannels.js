const { Anthropic } = require('@anthropic-ai/sdk');
const { hanhanahan, getConfig } = require('../config.js');
const claude = new Anthropic({ apiKey: getConfig().claudeApiKey });
const fetch = require('node-fetch');
const log = require("../logger.js");

// 会話履歴を保持するオブジェクト
const specialConversationHistory = {};

async function getBase64FromUrl(url) {
    try {
        const response = await fetch(url);
        const buffer = await response.buffer();
        return buffer.toString('base64');
    } catch (error) {
        console.error('Error fetching image:', error);
        return null;
    }
}
async function handleSpecialChannelMessage(message) {
    if (message.author.bot) return;
    log.info(getConfig().specialSystemPlan)
    // 特定のチャンネルでのみコマンドを処理
    if (getConfig().specialChannelIds.includes(message.channel.id)) {

        await hanhanahan(message);

        const prompt = message.content.trim();
        const userId = message.author.id;

        if (prompt) {
            // 会話履歴にユーザーが過去に送ったメッセージを追加
            if (!specialConversationHistory[userId]) {
                specialConversationHistory[userId] = [];
            }

            // メッセージが返信かどうかをチェック
            if (message.reference) {
                // 返信の場合、返信元のメッセージに続けて生成
                specialConversationHistory[userId].push({ role: 'user', content: prompt });
            } else {
                // 新規の質問の場合、会話履歴をリセット
                specialConversationHistory[userId] = [{ role: 'user', content: prompt }];
            }

            // 画像が添付されているか確認
            if (message.attachments.size > 0) {
                // 添付された画像の最大5枚を処理
                const imageAttachments = [...message.attachments.values()].slice(0, 5); // 最大5枚
                const imageMessages = [];

                for (const attachment of imageAttachments) {
                    const base64Image = await getBase64FromUrl(attachment.url); // URLをBase64に変換
                    if (base64Image) {
                        imageMessages.push({
                            "type": "image",
                            "source": {
                                "type": "base64",
                                "media_type": attachment.contentType, // 画像の形式を動的に取得
                                "data": base64Image,
                            },
                        });
                    }
                }

                // テキストと画像のメッセージを構築
                const messagesToSend = [
                    ...imageMessages,
                    {
                        "type": "text",
                        "text": prompt ? prompt : "これらのイメージを描写してください。",
                    },
                ];

                // 応答生成中に🤔絵文字を送信
                const loadingMessage = await message.reply('🤔 生成中...');

                try {
                    // 画像とテキストのメッセージをClaude APIに送信
                    const stream = claude.messages.stream({
                        system: getConfig().specialSystemPlan,
                        messages: [
                            {
                                "role": "user",
                                "content": messagesToSend,
                            },
                        ],
                        model: getConfig().spModel,
                        max_tokens: 1000, // max_tokensは適切な上限に設定
                    });

                    const response = await stream.finalMessage();
                    const generatedContent = response.content[0].text;

                    // 🤔絵文字を生成された回答で置き換える
                    await loadingMessage.edit(generatedContent);

                    // 生成された回答を会話履歴に追加
                    specialConversationHistory[userId].push({ role: 'assistant', content: generatedContent });

                } catch (error) {
                    log.error('Error generating response:', error);
                    await loadingMessage.edit('回答の生成中にエラーが発生しました。```'+ error.message+'```');
                }
            } else if (message.content) {
                // テキストメッセージの場合は通常通り生成
                const loadingMessage = await message.reply('🤔 生成中...');

                try {
                    // Claude APIを使用してメッセージを生成
                    const stream = claude.messages.stream({
                        system: getConfig().specialSystemPlan,
                        messages: specialConversationHistory[userId], // 会話履歴を使用
                        model: getConfig().spModel,
                        max_tokens: 1000, // max_tokensは適切な上限に設定
                    });

                    const response = await stream.finalMessage();
                    const generatedContent = response.content[0].text;

                    // 🤔絵文字を生成された回答で置き換える
                    await loadingMessage.edit(generatedContent);

                    // 生成された回答を会話履歴に追加
                    specialConversationHistory[userId].push({ role: 'assistant', content: generatedContent });

                } catch (error) {
                    log.error('Error generating response:', error);
                    await loadingMessage.edit('回答の生成中にエラーが発生しました。```'+ error.message+'```');
                }
            }
        }
    }
}

module.exports = { handleSpecialChannelMessage };