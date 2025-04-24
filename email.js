const nodemailer = require('nodemailer');
const { getConfig } = require('./config.js');

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: getConfig().EMAIL_USER,
        pass: getConfig().EMAIL_PASS,
    },
});



async function sendVerificationEmail(to, code) {
    const sendHTML = `
<!DOCTYPE html>
<html lang="ja">
<head>
    <title>認証コード</title>
    <meta content="text/html; charset=utf-8" http-equiv="Content-Type"/>
    <meta content="width=device-width" name="viewport"/>
    <style>
        /* デジタル表示板風フォントの読み込み */
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700&display=swap');
        
        body {
            font-family: 'Hiragino Kaku Gothic Pro', 'メイリオ', sans-serif;
            background-color: #f0f8e8;
            color: #333;
            margin: 0;
            padding: 20px;
            line-height: 1.6;
            text-align: center;
        }
        .main {
            max-width: 600px;
            margin: 0 auto;
            background-color: #fff;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .header {
            text-align: center;
            margin-bottom: 20px;
            color: #006400;
            border-bottom: 2px solid #006400;
            padding-bottom: 10px;
        }
        .racecourse {
            position: relative;
            height: 300px;
            background-color: #7fb069;
            border-radius: 20px;
            margin: 20px 0;
            overflow: hidden;
            padding: 10px;
        }
        .turf-vision {
            position: absolute;
            width: 80%;
            height: 130px;
            top: 20px;
            left: 10%;
            background-color: #000;
            border: 5px solid #666;
            border-radius: 5px;
            box-shadow: 0 5px 15px rgba(0,0,0,0.5);
            display: flex;
            justify-content: center;
            align-items: center;
            overflow: hidden;
            z-index: 30;
        }
        .vision-content {
            color: #ff0;
            font-size: 60px;
            font-weight: bold;
            text-align: center;
            font-family: 'Orbitron', 'Courier New', monospace;
            letter-spacing: 5px;
            text-shadow: 0 0 10px rgba(255,255,0,0.7);
            animation: blink 3s infinite;
            

            background: linear-gradient(to bottom, 
                rgba(255,255,0,0.8) 0%, 
                rgba(255,255,0,1) 50%, 
                rgba(255,255,0,0.8) 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            filter: drop-shadow(0 0 5px rgba(255,255,0,0.7));
        }
        @keyframes blink {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.7; }
        }
        .horses {
            position: absolute;
            bottom: 35px;
            width: 100%;
            left: 0;
            display: flex;
            justify-content: space-between;
            font-size: 40px;
            z-index: 20;
        }
        .horse {
            transform: scaleX(-1) scale(1.5);
            margin-bottom: 20px;
            filter: drop-shadow(2px 2px 3px rgba(0,0,0,0.3));
            animation: horseMove 8s infinite linear;
        }
      
        @keyframes horseMove {
            0% { 
                transform: translateX(-100%) scaleX(-1) scale(1.5) translateY(0px); 
            }
            25% { 
                transform: translateX(25%) scaleX(-1) scale(1.5) translateY(-5px); 
            }
            50% { 
                transform: translateX(100%) scaleX(-1) scale(1.5) translateY(0px); 
            }
            75% { 
                transform: translateX(300%) scaleX(-1) scale(1.5) translateY(-5px); 
            }
            100% { 
                transform: translateX(600%) scaleX(-1) scale(1.5) translateY(0px); 
            }
        }
        
        /* 馬のアニメーション開始を遅らせる */
        .horse:nth-child(1) { animation-delay: 0s; }
        .horse:nth-child(2) { animation-delay: 0.8s; }
        .horse:nth-child(3) { animation-delay: 0.3s; }
        .horse:nth-child(4) { animation-delay: 1.2s; }
        .horse:nth-child(5) { animation-delay: 0.5s; }
        
        /* 各馬を少し異なる速度で走らせる */
        .horse:nth-child(1) { animation-duration: 8s; }
        .horse:nth-child(2) { animation-duration: 9s; }
        .horse:nth-child(3) { animation-duration: 7.5s; }
        .horse:nth-child(4) { animation-duration: 8.5s; }
        .horse:nth-child(5) { animation-duration: 7s; }
        
        .grass {
            position: absolute;
            bottom: 0;
            top: 170px; /* ラチの位置に合わせる */
            width: 100%;
            left: 0;
            background: linear-gradient(to bottom, #7fb069 0%, #5a9634 50%, #4a8624 80%, #396614 100%);
            overflow: hidden;
            z-index: 10;
        }
        
        /* リアルな芝生の表現 */
        .grass::before {
            content: "";
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: 
                radial-gradient(circle, transparent 30%, rgba(0,0,0,0.07) 70%) 0 0/20px 20px,
                radial-gradient(circle, transparent 30%, rgba(255,255,255,0.05) 70%) 10px 10px/20px 20px;
            animation: grassMove 3s infinite alternate;
        }
        
        @keyframes grassMove {
            from { background-position: 0 0, 10px 10px; }
            to { background-position: 5px 0, 15px 10px; }
        }
        
        /* 芝目の表現を追加 */
        .grass::after {
            content: "";
            position: absolute;
            top: 5px;
            left: 0;
            right: 0;
            bottom: 0;
            background: 
                repeating-linear-gradient(
                    90deg,
                    transparent,
                    transparent 15px,
                    rgba(0,0,0,0.03) 15px,
                    rgba(0,0,0,0.03) 30px
                );
        }
        
        /* よりリアルなラチの表現 */
        .rail {
            position: absolute;
            top: 170px;
            width: 100%;
            left: 0;
            height: 20px;
            display: flex;
            z-index: 15;
        }
        
 
        .rail-post {
            width: 2px;
            height: 10px;
            background-color: #428c56;
            border-radius: 1px;
            box-shadow: 0 1px 2px rgba(0,0,0,0.2);
            position: absolute;
        }
        

        .rail-bar {
            position: absolute;
            top: 8px;
            width: 100%;
            height: 4px;
            background-color: #fff;
            box-shadow: 0 1px 2px rgba(0,0,0,0.2);
        }
        
        /* ラチの継ぎ目表現 */
        .rail-joint {
            position: absolute;
            top: 7px;
            width: 6px;
            height: 6px;
            background-color: #eee;
            border-radius: 50%;
            box-shadow: 0 1px 1px rgba(0,0,0,0.2);
        }
        
        .jra-logo {
            text-align: center;
            margin: 20px 0;
        }
        .jra-logo div {
            display: inline-block;
            background-color: #858181;
            color: white;
            font-weight: bold;
            padding: 5px 15px;
            border-radius: 5px;
        }
        .footer {
            margin-top: 20px;
            text-align: center;
            font-size: 0.9em;
            color: #666;
        }
    </style>
</head>
<body>
    <div class="main">
        <div class="header">
            <h2>ようこそ！</h2>
        </div>

        <div class="jra-logo">
            <div>📝 認証コードを入力</div>
            <p>Discordの<b>👆</b>ボタンを押して下の認証コードを入力！！</p>
        </div>

        <div class="racecourse">
            <!-- ターフビジョン -->
            <div class="turf-vision">
                <div class="vision-content">${code}</div>
            </div>

            <!-- 芝生 -->
            <div class="grass"></div>
            
            <!-- ラチ -->
            <div class="rail">
                <div class="rail-bar"></div>
                
                <!-- ラチのポストを位置指定で配置 -->
         
                <div class="rail-post" style="left: 42px;"></div>
                <div class="rail-post" style="left: 122px;"></div>
                <div class="rail-post" style="left: 202px;"></div>
                <div class="rail-post" style="left: 282px;"></div>
                <div class="rail-post" style="left: 362px;"></div>
                <div class="rail-post" style="left: 442px;"></div>
                <div class="rail-post" style="left: 522px;"></div>
                
                <!-- ラチの継ぎ目表現 -->
                <div class="rail-joint" style="left: 40px;"></div>
                <div class="rail-joint" style="left: 120px;"></div>
                <div class="rail-joint" style="left: 200px;"></div>
                <div class="rail-joint" style="left: 280px;"></div>
                <div class="rail-joint" style="left: 360px;"></div>
                <div class="rail-joint" style="left: 440px;"></div>
                <div class="rail-joint" style="left: 520px;"></div>
            </div>

            <!-- 馬の絵文字 -->
            <div class="horses">
                <div class="horse">🐎</div>
                <div class="horse">🏇</div>
                <div class="horse">🐎</div>
                <div class="horse">🏇</div>
                <div class="horse">🐎</div>
            </div>
        </div>

        <p><b>ターフビジョンに表示されている6桁の数字</b>があなたの認証コードです。</p>
        <p>このメールに心当たりがない場合は破棄してください。</p>

        <div class="footer">
            <p>※このメールは自動送信されています。</p>
        </div>
    </div>
</body>
</html>
`;
    const mailOptions = {
        from: `"Verify Bot" <${getConfig().EMAIL_USER}>`,
        to,
        subject: 'メール認証',
        text: 'No reply',
        html: sendHTML,
    };

    return transporter.sendMail(mailOptions);
}

module.exports = { sendVerificationEmail };
