const { User } = require('discord.js');

User.prototype.tag = typeof this.username === 'string'
    ? this.discriminator === '0'
        ? this.globalName ? `${this.globalName} (@${this.username})` : `@${this.username}`
        : `${this.username}#${this.discriminator}`
    : null;