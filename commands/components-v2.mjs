import { 
    SlashCommandBuilder, 
    PermissionFlagsBits, 
    InteractionContextType, 
    ButtonStyle, 
    ButtonBuilder, 
    ContainerBuilder, 
    MessageFlags, 
    SectionBuilder, 
    SeparatorSpacingSize, 
    TextDisplayBuilder, 
} from 'discord.js';

const commandObject = {
    command: new SlashCommandBuilder()
        .setName("components-v2")
        .setDescription("components test")
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .setContexts(InteractionContextType.Guild),
    /**
     * @param {ChatInputCommandInteraction} interaction
     */
    async execute(interaction) {

        const container = new ContainerBuilder();

        const text1 = new TextDisplayBuilder().setContent(
            [
                '# 参加認証',
                '-# 会話を開始するには参加認証を済ませる必要があります。',
                '-# @everyone',
                'ボタンを押しても反応しない、メールが届かない、コードを入力しても認証されない、などの問題が発生した場合は <@864735082732322867> にご連絡ください。',
                '## 認証方法',
            ].join('\n'),
        );
        container.addTextDisplayComponents(text1);
        const text2 = new TextDisplayBuilder().setContent(
            [
                '### 1. 認証コードを取得する',
                '- `[✅ 認証コードを取得]` ボタンを押して、入力欄に**学校の**自分のメールアドレスを入力する。',
                '-# s00000@s.salesio-sp.ac.jp',
            ].join('\n'),
        );
        const confirm1 = new ButtonBuilder()
            .setCustomId('mailad')
            .setLabel('認証コードを取得')
            .setEmoji('✅')
            .setStyle(ButtonStyle.Success);
        const section2 = new SectionBuilder().addTextDisplayComponents(text2).setButtonAccessory(confirm1);

        container.addSectionComponents(section2);

        container.addSeparatorComponents(separator => separator.setSpacing(SeparatorSpacingSize.Large));

        const text3 = new TextDisplayBuilder().setContent(
            [
                '### 2. 届いた認証コードを入力する',
                '- `[📝 認証コードを入力]` ボタンを押して、入力欄に届いたメールに記載されたコードを入力する。',
            ].join('\n'),
        );

        const verifyCode2 = new ButtonBuilder()
            .setCustomId('vcode')
            .setLabel('認証コードを入力')
            .setEmoji('📝')
            .setStyle(ButtonStyle.Secondary);
        const section3 = new SectionBuilder().addTextDisplayComponents(text3).setButtonAccessory(verifyCode2);

        container.addSectionComponents(section3);

        container.addSeparatorComponents(separator => separator.setSpacing(SeparatorSpacingSize.Large));

        const text4 = new TextDisplayBuilder().setContent(
            [
                '下のボタンを押すと、このサーバーにいるメンバーリストを表示できます / このBotの機能を表示します。'
            ]
                .join('\n'),
        );

        container.addTextDisplayComponents(text4);

        const member = new ButtonBuilder()
            .setCustomId('member')
            .setLabel('在籍簿')
            .setEmoji('📖')
            .setStyle(ButtonStyle.Primary);
        const commandList = new ButtonBuilder()
            .setCustomId('commandlist')
            .setLabel('コマンドリスト（準備中）')
            .setEmoji('🔎')
            .setDisabled(true)
            .setStyle(ButtonStyle.Secondary);

        container.addActionRowComponents(row => row.addComponents(member,commandList));

        const hintText = new TextDisplayBuilder().setContent(
            "-# ※verify.ouma3@gmail.com からメールが届きますが、迷惑メールフォルダーに入っていることがほとんどです。30秒待っても受信ボックスに無いときは迷惑メールフォルダーを確認してください。",
        );

        container.addTextDisplayComponents(hintText);

        await interaction.channel.send({
            components: [container],
            flags: MessageFlags.IsComponentsV2,
        });
    }
};

export default commandObject;