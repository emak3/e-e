import { User } from 'discord.js';

Object.defineProperty(User.prototype, 'tag', {
  get: function() {
    return typeof this.username === 'string'
      ? this.discriminator === '0'
        ? this.globalName 
          ? `${this.globalName} (@${this.username})` 
          : `@${this.username}`
        : `${this.username}#${this.discriminator}`
      : null;
  }
});

export default {};