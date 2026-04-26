import { PermissionsBitField, AuditLogEvent } from "discord.js";
import { replyEmbed, buildCoolEmbed } from "../../utils/embeds.js";
import { getGuildSettings } from "../../utils/database.js";
import { getDB } from "../../utils/db.js";

const ACTION_LABELS = {
    [AuditLogEvent.MemberBan]:        "🔨 Ban",
    [AuditLogEvent.MemberBanRemove]:  "✅ Unban",
    [AuditLogEvent.MemberKick]:       "👢 Kick",
    [AuditLogEvent.MemberUpdate]:     "✏️ Member Update",
    [AuditLogEvent.MemberRoleUpdate]: "🎭 Role Update",
    [AuditLogEvent.MessageDelete]:    "🗑️ Message Deleted",
    [AuditLogEvent.MessageBulkDelete]:"🗑️ Bulk Delete",
    [AuditLogEvent.ChannelCreate]:    "📁 Channel Created",
    [AuditLogEvent.ChannelDelete]:    "📁 Channel Deleted",
    [AuditLogEvent.ChannelUpdate]:    "📁 Channel Updated",
    [AuditLogEvent.RoleCreate]:       "🎭 Role Created",
    [AuditLogEvent.RoleDelete]:       "🎭 Role Deleted",
    [AuditLogEvent.RoleUpdate]:       "🎭 Role Updated",
    [AuditLogEvent.InviteCreate]:     "📨 Invite Created",
    [AuditLogEvent.InviteDelete]:     "📨 Invite Deleted",
    [AuditLogEvent.GuildUpdate]:      "⚙️ Server Updated",
};

const MOD_CASE_LABELS = {
    ban: "🔨 Ban",
    kick: "👢 Kick",
    softban: "🧹 Softban",
    timeout: "⏱️ Timeout",
    untimeout: "✅ Untimeout",
    warn: "⚠️ Warn",
    warn_remove: "🧹 Warn Removed",
    warn_clear: "🧽 Warns Cleared",
    auto_timeout: "⏱️ Auto Timeout",
    auto_kick: "👢 Auto Kick",
    auto_ban: "🔨 Auto Ban",
};

export default {
    name: "audit",
    async execute(message, args) {
        if (!message.guild) return;
        if (!message.member.permissions.has(PermissionsBitField.Flags.ViewAuditLog)) {
            return replyEmbed(message, {
                type: "error", title: "⛔ Permission Denied",
                description: "You need the **View Audit Log** permission.",
            });
        }

        const settings = getGuildSettings(message.guild.id);
        if (!settings.plugins?.audit_log) {
            return replyEmbed(message, {
                type: "error", title: "❌ Plugin Disabled",
                description: "The Audit Log plugin is not enabled. Use `/plugins enable audit_log`.",
            });
        }

        const target = message.mentions.users.first();
        if (!target) {
            return replyEmbed(message, {
                type: "error", title: "❌ Usage",
                description: "`,audit @user`\n*Shows the bot's recorded actions and your moderation cases for that user.*",
            });
        }

        const db = await getDB();
        const auditRows = await db.all(
            `SELECT action, executor_id, reason, created_at FROM audit_log
             WHERE guild_id = ? AND target_id = ?
             ORDER BY created_at DESC LIMIT 10`,
            message.guild.id, target.id
        );

        const caseRows = await db.all(
            `SELECT case_number, action, executor_id, executor_tag, reason, duration_ms, created_at FROM mod_cases
             WHERE guild_id = ? AND target_id = ?
             ORDER BY created_at DESC LIMIT 10`,
            message.guild.id, target.id
        );

        if (!auditRows.length && !caseRows.length) {
            return replyEmbed(message, {
                type: "info", title: "📋 Audit Log",
                description: `No logged actions found for ${target}.`,
            });
        }

        const fields = [];

        if (caseRows.length) {
            const caseLines = caseRows.map(r => {
                const label = MOD_CASE_LABELS[r.action] ?? `\`${r.action}\``;
                const ts = `<t:${Math.floor(r.created_at / 1000)}:R>`;
                const by = r.executor_id ? `<@${r.executor_id}>` : "_unknown_";
                const reason = r.reason ? ` — ${String(r.reason).slice(0, 50)}` : "";
                return `**\`#${r.case_number}\`** ${label} by ${by} ${ts}${reason}`;
            });
            fields.push({
                name: `📁 Moderation Cases [${caseRows.length}]`,
                value: caseLines.join("\n").slice(0, 1024),
                inline: false,
            });
        }

        if (auditRows.length) {
            const auditLines = auditRows.map(r => {
                const label = ACTION_LABELS[Number(r.action)] ?? `Action \`${r.action}\``;
                const by = r.executor_id ? `<@${r.executor_id}>` : "_unknown_";
                const ts = `<t:${Math.floor(r.created_at / 1000)}:R>`;
                const reason = r.reason ? ` — ${String(r.reason).slice(0, 50)}` : "";
                return `${label} by ${by} ${ts}${reason}`;
            });
            fields.push({
                name: `🛡️ Discord Audit Log [${auditRows.length}]`,
                value: auditLines.join("\n").slice(0, 1024),
                inline: false,
            });
        }

        const embed = buildCoolEmbed({
            guildId: message.guild.id,
            type: "info",
            title: `📋 Audit — ${target.tag}`,
            description: `User ID: \`${target.id}\``,
            fields,
            showAuthor: true,
            showFooter: true,
            footerText: message.guild.name,
            client: message.client,
        }).setThumbnail(target.displayAvatarURL({ dynamic: true, size: 128 }));

        return message.reply({ embeds: [embed] });
    },
};
