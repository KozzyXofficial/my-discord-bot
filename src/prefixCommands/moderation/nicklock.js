import { PermissionsBitField } from "discord.js";
import { getGuildSettings, saveSettings } from "../../utils/database.js";
import { replyEmbed, buildCoolEmbed } from "../../utils/embeds.js";

export default {
    name: "nicklock",
    async execute(message, args) {
        if (!message.member.permissions.has(PermissionsBitField.Flags.ManageNicknames)) {
            return replyEmbed(message, {
                type: "error", title: "⛔ Permission Needed",
                description: "You need **Manage Nicknames** to lock nicknames.",
            });
        }
        const target = message.mentions.members.first();
        if (!target) {
            return replyEmbed(message, {
                type: "error", title: "❌ Usage",
                description: "`,nicklock @user [nickname]`\n*If no nickname is given, locks to their current nickname.*",
            });
        }

        const customNick = args.slice(1).join(" ").trim();
        const lockedNick = customNick || target.nickname || target.user.username;

        const settings = getGuildSettings(message.guild.id);
        settings.nickLocks = settings.nickLocks || {};
        settings.nickLocks[target.id] = lockedNick;
        await saveSettings();

        if (customNick && target.nickname !== lockedNick) {
            await target.setNickname(lockedNick, `Nicklock by ${message.author.tag}`).catch(() => {});
        }

        const embed = buildCoolEmbed({
            guildId: message.guild.id,
            type: "settings",
            title: "🔒 Nickname Locked",
            fields: [
                { name: "👤 Member", value: `${target}`, inline: true },
                { name: "👮 Moderator", value: `${message.author}`, inline: true },
                { name: "🔒 Locked To", value: `\`${lockedNick}\``, inline: false },
            ],
            showAuthor: false,
            showFooter: true,
            footerText: message.guild.name,
        });

        return message.reply({ embeds: [embed] });
    }
};
