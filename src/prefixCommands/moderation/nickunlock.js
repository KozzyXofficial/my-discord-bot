import { PermissionsBitField } from "discord.js";
import { getGuildSettings, saveSettings } from "../../utils/database.js";
import { replyEmbed, buildCoolEmbed } from "../../utils/embeds.js";

export default {
    name: "nickunlock",
    async execute(message, args) {
        if (!message.member.permissions.has(PermissionsBitField.Flags.ManageNicknames)) {
            return replyEmbed(message, {
                type: "error", title: "⛔ Permission Needed",
                description: "You need **Manage Nicknames** to unlock nicknames.",
            });
        }
        const target = message.mentions.members.first();
        if (!target) {
            return replyEmbed(message, {
                type: "error", title: "❌ Usage",
                description: "`,nickunlock @user`",
            });
        }

        const settings = getGuildSettings(message.guild.id);
        settings.nickLocks = settings.nickLocks || {};
        if (!settings.nickLocks[target.id]) {
            return replyEmbed(message, {
                type: "info", title: "ℹ️ Not Locked",
                description: `${target}'s nickname isn't locked.`,
            });
        }
        delete settings.nickLocks[target.id];
        await saveSettings();

        const embed = buildCoolEmbed({
            guildId: message.guild.id,
            type: "success",
            title: "🔓 Nickname Unlocked",
            fields: [
                { name: "👤 Member", value: `${target}`, inline: true },
                { name: "👮 Moderator", value: `${message.author}`, inline: true },
            ],
            showAuthor: false,
            showFooter: true,
            footerText: message.guild.name,
        });

        return message.reply({ embeds: [embed] });
    }
};
