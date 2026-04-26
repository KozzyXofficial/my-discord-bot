import { PermissionsBitField } from "discord.js";
import { getWarningData, saveWarnings, getGuildSettings } from "../../utils/database.js";
import { replyEmbed, postCase, sendEmbed, buildCoolEmbed } from "../../utils/embeds.js";
import { trySendModDM, validateModAction, createCase, formatDuration } from "../../utils/moderationUtils.js";

const WARN_THRESHOLD_EMOJIS = ["⚠️", "🚨", "🔥", "🛑", "⚡"];

function sendWarnThresholdNotice(channel, guildId, text) {
    const emoji = WARN_THRESHOLD_EMOJIS[Math.floor(Math.random() * WARN_THRESHOLD_EMOJIS.length)];
    return sendEmbed(channel, guildId, {
        type: "warning",
        title: `${emoji} Warn Threshold Triggered`,
        description: text,
    });
}

async function checkWarnThresholds(member, warnCount, channel, executor) {
    const settings = getGuildSettings(member.guild.id);
    if (!settings.warnThresholds) return;
    for (const t of settings.warnThresholds) {
        if (warnCount === t.count) {
            const reason = `Warn threshold reached (${warnCount} warns)`;
            try {
                if (t.action === "timeout") {
                    await member.timeout((t.time || 0) * 60000, reason);
                    await createCase({ guild: member.guild, action: "auto_timeout", target: member.user, executor: { id: executor.id, tag: executor.tag }, reason, durationMs: (t.time || 0) * 60000 });
                    sendWarnThresholdNotice(channel, member.guild.id, `${member} has been **timed out** for **${formatDuration((t.time || 0) * 60000)}** (auto).`);
                }
                if (t.action === "kick") {
                    await member.kick(reason);
                    await createCase({ guild: member.guild, action: "auto_kick", target: member.user, executor: { id: executor.id, tag: executor.tag }, reason });
                    sendWarnThresholdNotice(channel, member.guild.id, `${member.user.tag} has been **kicked** (auto).`);
                }
                if (t.action === "ban") {
                    await member.ban({ reason });
                    await createCase({ guild: member.guild, action: "auto_ban", target: member.user, executor: { id: executor.id, tag: executor.tag }, reason });
                    sendWarnThresholdNotice(channel, member.guild.id, `${member.user.tag} has been **banned** (auto).`);
                }
            } catch {}
        }
    }
}

export default {
    name: "warn",
    async execute(message, args) {
        if (!message.member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) {
            return replyEmbed(message, { type: "error", title: "⛔ Permission Needed", description: "You need **Timeout Members** permission to warn." });
        }
        const target = message.mentions.members.first();
        if (!target) {
            return replyEmbed(message, {
                type: "error", title: "❌ Usage",
                description: "`,warn @user [reason]`\n`,warn remove @user [count]`",
            });
        }

        // ── REMOVE warns
        if (args[0] === "remove") {
            const v = validateModAction({ executor: message.member, target, action: "modify warnings of" });
            if (!v.ok) return replyEmbed(message, { type: "error", title: "❌ Cannot Modify", description: v.reason });

            const countArg = args.find((a) => /^\d+$/.test(a));
            const countToRemove = countArg ? parseInt(countArg, 10) : 1;
            if (!Number.isFinite(countToRemove) || countToRemove <= 0) {
                return replyEmbed(message, { type: "error", title: "❌ Usage", description: "`,warn remove @user [count]`" });
            }

            const data = getWarningData(message.guild.id, target.id);
            const before = data.count;
            data.count = Math.max(0, data.count - countToRemove);
            data.history.push({ action: "remove", by: message.author.id, count: countToRemove, at: Date.now() });
            await saveWarnings();

            const caseNumber = await createCase({
                guild: message.guild, action: "warn_remove",
                target: target.user, executor: message.author,
                reason: `Removed ${countToRemove} warning(s)`,
            });

            await trySendModDM({
                user: target.user,
                guild: message.guild,
                type: "success",
                title: "🧹 Warnings reduced",
                description: "A moderator reduced your warning count.",
                moderatorTag: message.author.tag,
                reason: `Removed ${countToRemove} warning(s). Total: ${before} → ${data.count}.`,
                caseNumber,
            });

            return replyEmbed(message, {
                type: "success",
                title: "✅ Warnings Reduced",
                description: `Removed **${countToRemove}** warning(s) from ${target}.\n**Total:** ${before} → **${data.count}**\n**Case:** \`#${caseNumber}\``,
            });
        }

        // ── ADD warn
        const v = validateModAction({ executor: message.member, target, action: "warn" });
        if (!v.ok) return replyEmbed(message, { type: "error", title: "❌ Cannot Warn", description: v.reason });

        const reason = args.slice(1).join(" ") || "No reason provided.";
        const data = getWarningData(message.guild.id, target.id);
        data.count++;
        data.history.push({ action: "add", by: message.author.id, reason, at: Date.now() });
        await saveWarnings();

        const caseNumber = await createCase({
            guild: message.guild, action: "warn",
            target: target.user, executor: message.author, reason,
        });

        await trySendModDM({
            user: target.user,
            guild: message.guild,
            type: "warning",
            title: "⚠️ You received a warning",
            description: "A moderator has issued you a warning.",
            moderatorTag: message.author.tag,
            reason: `${reason}\n**Total warnings:** ${data.count}`,
            caseNumber,
        });

        const embed = buildCoolEmbed({
            guildId: message.guild.id,
            type: "warning",
            title: "⚠️ Warning Issued",
            fields: [
                { name: "👤 Target", value: `${target}\n\`${target.id}\``, inline: true },
                { name: "👮 Moderator", value: `${message.author}\n\`${message.author.id}\``, inline: true },
                { name: "📁 Case", value: `#${caseNumber}`, inline: true },
                { name: "📊 Total Warnings", value: `**${data.count}**`, inline: true },
                { name: "📝 Reason", value: reason, inline: false },
            ],
            showAuthor: false,
            showFooter: true,
            footerText: `Case #${caseNumber} • ${message.guild.name}`,
        }).setThumbnail(target.user.displayAvatarURL({ dynamic: true, size: 128 }));

        await message.reply({ embeds: [embed] });
        await postCase(message.guild, embed, message.channel.id);

        await checkWarnThresholds(target, data.count, message.channel, message.author);
    }
};
