const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');
const { getConfig } = require('../config.js');

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: getConfig().EMAIL_USER,
        pass: getConfig().EMAIL_PASS,
    },
});

// テンプレートHTMLを読み込んで、{{CODE}} を実際のコードに置換
function loadEmailTemplate(code) {
    const templatePath = path.join(__dirname, 'template.html');
    const template = fs.readFileSync(templatePath, 'utf-8');
    return template.replace('{{CODE}}', code);
}

async function sendVerificationEmail(to, code) {
    const html = loadEmailTemplate(code);

    const mailOptions = {
        from: `"Verify Bot" <${getConfig().EMAIL_USER}>`,
        to,
        subject: 'メール認証',
        text: 'No reply',
        html,
    };

    return transporter.sendMail(mailOptions);
}

module.exports = { sendVerificationEmail };
