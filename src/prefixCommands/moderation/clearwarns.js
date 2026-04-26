import { PermissionsBitField } from "discord.js";
import { getWarningData, saveWarnings } from "../../utils/database.js";
import { replyEmbed, postCase, buildCoolEmbed } from "../../utils/embeds.js";
import { trySendModDM, validateModAction, createCase } from "../../utils/moderationUtils.js";

export default {
    name: "clearwarns",
    async execute(message, args) {
        if (!message.member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) {
            return replyEmbed(message, { type: "error", title: "⛔ Permission Needed", description: "You need **Timeout Members** permission." });
        }
        const target = message.mentions.members.first();
        if (!target) {
            return replyEmbed(message, { type: "error", title: "❌ Usage", description: "`,clearwarns @user`" });
        }

        const v = validateModAction({ executor: message.member, target, action: "clear warnings of" });
        if (!v.ok) return replyEmbed(message, { type: "error", title: "❌ Cannot Clear", description: v.reason });

        const data = getWarningData(message.guild.id, target.id);
        const before = data.count;

        if (before === 0) {
            return replyEmbed(message, {
                type: "info",
                title: "ℹ️ Nothing to clear",
                description: `${target} already has no warnings.`,
            });
        }

        data.count = 0;
        data.history.push({ action: "clear", by: message.author.id, at: Date.now() });
        await saveWarnings();

        const caseNumber = await createCase({
            guild: message.guild, action: "warn_clear",
            target: target.user, executor: message.author,
            reason: `Cleared ${before} warning(s)`,
        });

        await trySendModDM({
            user: target.user,
            guild: message.guild,
            type: "success",
            title: "🧽 All warnings cleared",
            description: "Your warnings in the server were cleared by a moderator.",
            moderatorTag: message.author.tag,
            reason: `Cleared ${before} warning(s).`,
            caseNumber,
        });

        const embed = buildCoolEmbed({
            guildId: message.guild.id,
            type: "success",
            title: "🧽 Warnings Cleared",
            fields: [
                { name: "👤 Target", value: `${target}\n\`${target.id}\``, inline: true },
                { name: "👮 Moderator", value: `${message.author}\n\`${message.author.id}\``, inline: true },
                { name: "📁 Case", value: `#${caseNumber}`, inline: true },
                { name: "🧹 Cleared", value: `**${before}** warning(s)`, inline: false },
            ],
            showAuthor: false,
            showFooter: true,
            footerText: `Case #${caseNumber} • ${message.guild.name}`,
        }).setThumbnail(target.user.displayAvatarURL({ dynamic: true, size: 128 }));

        await message.reply({ embeds: [embed] });
        await postCase(message.guild, embed, message.channel.id);
    }
};
