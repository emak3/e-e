const log = require("./logger.js");

let config = {
  "token": process.env.TOKEN,
  "clientId":process.env.CLIENT_ID,
  "channelIds": [process.env.CHANNEL_ID_1, process.env.CHANNEL_ID_2],
  "specialChannelIds": [process.env.SPECIAL_CHANNEL_ID_1, process.env.SPECIAL_CHANNEL_ID_2],
  "claudeApiKey": process.env.CLAUDE_API_KEY,
  "systemPlan": process.env.SYSTEM_PLAN,
  "specialSystemPlan": null,
  "specialSystemPlanClientId": process.env.SPECIAL_SYSTEM_PLAN_CHANNEL_ID,
  "spModel": process.env.SP_MODEL,
  "nlModel": process.env.NL_MODEL,
  "profile": process.env.PROFILE,
  "verifyRoleId": process.env.VERIFY_ROLE_ID,
  "EMAIL_USER": process.env.EMAIL_USER,
  "EMAIL_PASS": process.env.EMAIL_PASS,
  "inviteLink": process.env.INVITE_LINK
};
const channelId = config.specialSystemPlanClientId;
async function oldHanhan(client) {
  if (config.specialSystemPlan == null) {
    const channel = await client.channels.fetch(channelId);
    const messages = await channel.messages.fetch({ limit: 1 });
    const latestMessage = messages.first().content;
    log.info(`specialSystemPlanに設定: ${latestMessage}`);
    config.specialSystemPlan = latestMessage;
  }
}

async function hanhanahan(message) {
  if (message.channel.id === channelId) {
    config.specialSystemPlan = message.content;
    log.info(`specialSystemPlanに設定: ${config.specialSystemPlan}`);
    message.react('💡');

  }
}
function getConfig() {
  return config;
}
module.exports = { oldHanhan, hanhanahan, getConfig };