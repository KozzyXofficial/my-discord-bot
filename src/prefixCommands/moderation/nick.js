import { PermissionsBitField } from "discord.js";
import { replyEmbed, buildCoolEmbed } from "../../utils/embeds.js";
import { validateModAction } from "../../utils/moderationUtils.js";

export default {
    name: "nick",
    async execute(message, args) {
        if (!message.member.permissions.has(PermissionsBitField.Flags.ManageNicknames)) {
            return replyEmbed(message, {
                type: "error", title: "⛔ Permission Needed",
                description: "You need **Manage Nicknames** to change nicknames.",
            });
        }
        const target = message.mentions.members.first();
        if (!target) {
            return replyEmbed(message, {
                type: "error", title: "❌ Usage",
                description: "`,nick @user <new nickname>`\n`,nick @user reset` to reset",
            });
        }

        const v = validateModAction({ executor: message.member, target, action: "rename" });
        if (!v.ok) return replyEmbed(message, { type: "error", title: "❌ Cannot Rename", description: v.reason });

        const rest = args.slice(1).join(" ").trim();
        const wantsReset = !rest || ["reset", "clear", "off"].includes(rest.toLowerCase());
        const newNick = wantsReset ? null : rest;

        if (newNick && newNick.length > 32) {
            return replyEmbed(message, {
                type: "error", title: "❌ Too Long",
                description: "Nicknames must be 32 characters or fewer.",
            });
        }

        const oldNick = target.nickname || target.user.username;

        try {
            await target.setNickname(newNick, `Changed by ${message.author.tag}`);
        } catch {
            return replyEmbed(message, {
                type: "error", title: "❌ Failed",
                description: "I couldn't change that nickname.",
            });
        }

        const embed = buildCoolEmbed({
            guildId: message.guild.id,
            type: "mod",
            title: wantsReset ? "🔄 Nickname Reset" : "✏️ Nickname Changed",
            fields: [
                { name: "👤 Member", value: `${target}`, inline: true },
                { name: "👮 Moderator", value: `${message.author}`, inline: true },
                { name: "📝 Before", value: `\`${oldNick}\``, inline: false },
                { name: "📝 After", value: `\`${newNick || target.user.username}\``, inline: false },
            ],
            showAuthor: false,
            showFooter: true,
            footerText: message.guild.name,
        });

        return message.reply({ embeds: [embed] });
    }
};
