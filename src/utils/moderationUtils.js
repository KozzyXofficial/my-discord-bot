import { PermissionsBitField } from "discord.js";
import { buildCoolEmbed, replyEmbed, postCase } from "./embeds.js";
import { getDB } from "./db.js";

// ---------------- HIERARCHY & VALIDATION ----------------
// Validates that `executor` (GuildMember) can perform `action` on `target` (GuildMember | User).
// Returns { ok: true } or { ok: false, reason: "..." }.
export function validateModAction({ executor, target, action = "moderate", requireMember = true }) {
    if (!executor?.guild) return { ok: false, reason: "This must be used in a server." };
    const guild = executor.guild;

    if (!target) return { ok: false, reason: "Target user not found." };

    if (target.id === executor.id) {
        return { ok: false, reason: `You cannot ${action} yourself.` };
    }
    if (target.id === guild.client.user.id) {
        return { ok: false, reason: `You cannot ${action} the bot.` };
    }
    if (target.id === guild.ownerId) {
        return { ok: false, reason: `You cannot ${action} the server owner.` };
    }

    const targetMember = target.guild ? target : guild.members.cache.get(target.id);

    if (requireMember && !targetMember) {
        return { ok: false, reason: "Target is not a member of this server." };
    }

    if (targetMember) {
        // Executor role hierarchy
        if (executor.id !== guild.ownerId && executor.roles.highest.position <= targetMember.roles.highest.position) {
            return { ok: false, reason: `You cannot ${action} someone with a role equal to or higher than yours.` };
        }
        // Bot role hierarchy
        const me = guild.members.me;
        if (me && me.roles.highest.position <= targetMember.roles.highest.position) {
            return { ok: false, reason: `I cannot ${action} this user — their highest role is above mine.` };
        }
    }

    return { ok: true };
}

// ---------------- CASE ID HELPERS ----------------
async function nextCaseNumber(guildId) {
    const db = await getDB();
    const row = await db.get(
        "SELECT MAX(case_number) AS max FROM mod_cases WHERE guild_id = ?",
        guildId
    );
    return (row?.max || 0) + 1;
}

export async function createCase({ guild, action, target, executor, reason = null, durationMs = null }) {
    const db = await getDB();
    const caseNumber = await nextCaseNumber(guild.id);
    const now = Date.now();
    await db.run(
        `INSERT INTO mod_cases (guild_id, case_number, action, target_id, target_tag, executor_id, executor_tag, reason, duration_ms, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        guild.id, caseNumber, action,
        target.id, target.tag ?? target.user?.tag ?? null,
        executor.id, executor.tag ?? executor.user?.tag ?? null,
        reason, durationMs, now
    );
    return caseNumber;
}

// ---------------- DURATION FORMATTER ----------------
export function formatDuration(ms) {
    if (!ms || ms <= 0) return "Permanent";
    const s = Math.floor(ms / 1000);
    const d = Math.floor(s / 86400);
    const h = Math.floor((s % 86400) / 3600);
    const m = Math.floor((s % 3600) / 60);
    const parts = [];
    if (d) parts.push(`${d}d`);
    if (h) parts.push(`${h}h`);
    if (m) parts.push(`${m}m`);
    if (!parts.length) parts.push(`${s}s`);
    return parts.join(" ");
}

// ---------------- MOD ACTION DMs ----------------
export async function trySendModDM({ user, guild, type = "mod", title, description, moderatorTag, reason, durationText, caseNumber }) {
    try {
        if (!user || !guild) return false;

        const fields = [
            { name: "🏠 Server", value: guild.name, inline: true },
            { name: "👮 Moderator", value: moderatorTag || "Unknown", inline: true },
        ];
        if (caseNumber != null) fields.push({ name: "📁 Case", value: `#${caseNumber}`, inline: true });
        if (durationText) fields.push({ name: "⏱️ Duration", value: durationText, inline: true });
        if (reason) fields.push({ name: "📝 Reason", value: String(reason).slice(0, 1024), inline: false });
        fields.push({ name: "🆔 Your ID", value: `\`${user.id}\``, inline: true });

        const embed = buildCoolEmbed({
            guildId: guild.id,
            type,
            title,
            description,
            fields,
            showAuthor: false,
            showFooter: true,
            footerText: guild.name,
        });

        if (guild.iconURL()) embed.setThumbnail(guild.iconURL({ size: 128 }));
        await user.send({ embeds: [embed] });
        return true;
    } catch {
        return false;
    }
}

// ---------------- CHANNEL ANNOUNCEMENT BUILDER ----------------
function buildModEmbed({ guild, type = "mod", title, target, executor, reason, durationText, caseNumber, extra = [] }) {
    const targetUser = target.user ?? target;
    const executorUser = executor.user ?? executor;

    const fields = [
        { name: "👤 Target", value: `${targetUser.tag}\n\`${targetUser.id}\``, inline: true },
        { name: "👮 Moderator", value: `${executorUser.tag}\n\`${executorUser.id}\``, inline: true },
    ];
    if (caseNumber != null) fields.push({ name: "📁 Case", value: `#${caseNumber}`, inline: true });
    if (durationText) fields.push({ name: "⏱️ Duration", value: durationText, inline: true });
    if (reason) fields.push({ name: "📝 Reason", value: String(reason).slice(0, 1024), inline: false });
    fields.push(...extra);

    const embed = buildCoolEmbed({
        guildId: guild.id,
        type,
        title,
        fields,
        showAuthor: false,
        showFooter: true,
        footerText: caseNumber != null ? `Case #${caseNumber} • ${guild.name}` : guild.name,
    });

    if (targetUser.displayAvatarURL) {
        embed.setThumbnail(targetUser.displayAvatarURL({ dynamic: true, size: 128 }));
    }
    return embed;
}

// ---------------- KICK ----------------
export async function doKick(message, target, reason) {
    const v = validateModAction({ executor: message.member, target, action: "kick" });
    if (!v.ok) return replyEmbed(message, { type: "error", title: "❌ Cannot Kick", description: v.reason });

    if (!message.guild.members.me?.permissions?.has(PermissionsBitField.Flags.KickMembers)) {
        return replyEmbed(message, { type: "error", title: "❌ Bot Missing Permission", description: "I need **Kick Members**." });
    }

    try {
        const caseNumber = await createCase({ guild: message.guild, action: "kick", target: target.user, executor: message.author, reason });

        await trySendModDM({
            user: target.user,
            guild: message.guild,
            type: "mod",
            title: "👢 You were kicked",
            description: "You were kicked from the server.",
            moderatorTag: message.author.tag,
            reason,
            caseNumber,
        });
        await target.kick(reason);

        const embed = buildModEmbed({
            guild: message.guild, type: "mod", title: "👢 Member Kicked",
            target, executor: message.author, reason, caseNumber,
        });
        await message.reply({ embeds: [embed] });
        await postCase(message.guild, embed, message.channel.id);
    } catch (err) {
        console.error("Kick error:", err);
        return replyEmbed(message, { type: "error", title: "❌ Kick Failed", description: "Failed to kick that user." });
    }
}

// ---------------- BAN ----------------
export async function doBan(message, target, reason) {
    const v = validateModAction({ executor: message.member, target, action: "ban", requireMember: false });
    if (!v.ok) return replyEmbed(message, { type: "error", title: "❌ Cannot Ban", description: v.reason });

    if (!message.guild.members.me?.permissions?.has(PermissionsBitField.Flags.BanMembers)) {
        return replyEmbed(message, { type: "error", title: "❌ Bot Missing Permission", description: "I need **Ban Members**." });
    }

    try {
        const caseNumber = await createCase({ guild: message.guild, action: "ban", target, executor: message.author, reason });
        const appealNote = `\n\nTo appeal, use \`/appeal\` in any server with this bot and provide server ID \`${message.guild.id}\`.`;

        await trySendModDM({
            user: target,
            guild: message.guild,
            type: "mod",
            title: "🔨 You were banned",
            description: `You have been banned from the server.${appealNote}`,
            moderatorTag: message.author.tag,
            reason,
            caseNumber,
        });
        await message.guild.members.ban(target.id, { reason: `${message.author.tag}: ${reason}` });

        const embed = buildModEmbed({
            guild: message.guild, type: "mod", title: "🔨 Member Banned",
            target, executor: message.author, reason, caseNumber,
        });
        await message.reply({ embeds: [embed] });
        await postCase(message.guild, embed, message.channel.id);
    } catch (err) {
        console.error("Ban error:", err);
        return replyEmbed(message, { type: "error", title: "❌ Ban Failed", description: "Failed to ban that user." });
    }
}

// ---------------- SOFTBAN ----------------
export async function doSoftban(message, target, reason) {
    const v = validateModAction({ executor: message.member, target, action: "softban", requireMember: false });
    if (!v.ok) return replyEmbed(message, { type: "error", title: "❌ Cannot Softban", description: v.reason });

    if (!message.guild.members.me?.permissions?.has(PermissionsBitField.Flags.BanMembers)) {
        return replyEmbed(message, { type: "error", title: "❌ Bot Missing Permission", description: "I need **Ban Members**." });
    }

    try {
        const caseNumber = await createCase({ guild: message.guild, action: "softban", target, executor: message.author, reason });

        await trySendModDM({
            user: target,
            guild: message.guild,
            type: "mod",
            title: "🧹 You were softbanned",
            description: "You were temporarily banned to purge your recent messages. You can rejoin with a new invite.",
            moderatorTag: message.author.tag,
            reason,
            caseNumber,
        });
        await message.guild.members.ban(target.id, { deleteMessageSeconds: 7 * 24 * 60 * 60, reason: `${message.author.tag}: ${reason}` });
        await message.guild.members.unban(target.id, "Softban — auto unban");

        const embed = buildModEmbed({
            guild: message.guild, type: "mod", title: "🧹 Member Softbanned",
            target, executor: message.author, reason, caseNumber,
            extra: [{ name: "ℹ️ Notice", value: "Messages from the last 7 days were purged. User may rejoin.", inline: false }],
        });
        await message.reply({ embeds: [embed] });
        await postCase(message.guild, embed, message.channel.id);
    } catch (err) {
        console.error("Softban error:", err);
        return replyEmbed(message, { type: "error", title: "❌ Softban Failed", description: "Failed to softban that user." });
    }
}

// ---------------- TIMEOUT ----------------
export async function doTimeout(message, target, ms, reason = null) {
    const v = validateModAction({ executor: message.member, target, action: "timeout" });
    if (!v.ok) return replyEmbed(message, { type: "error", title: "❌ Cannot Timeout", description: v.reason });

    if (!message.guild.members.me?.permissions?.has(PermissionsBitField.Flags.ModerateMembers)) {
        return replyEmbed(message, { type: "error", title: "❌ Bot Missing Permission", description: "I need **Timeout Members**." });
    }

    try {
        const durationText = formatDuration(ms);
        const caseNumber = await createCase({ guild: message.guild, action: "timeout", target: target.user, executor: message.author, reason, durationMs: ms });

        await trySendModDM({
            user: target.user,
            guild: message.guild,
            type: "mod",
            title: "⏱️ You were timed out",
            description: "You were timed out in the server.",
            moderatorTag: message.author.tag,
            reason,
            durationText,
            caseNumber,
        });
        await target.timeout(ms, `${message.author.tag}: ${reason || "Timeout"}`);

        const embed = buildModEmbed({
            guild: message.guild, type: "mod", title: "⏱️ Member Timed Out",
            target, executor: message.author, reason, caseNumber, durationText,
        });
        await message.reply({ embeds: [embed] });
        await postCase(message.guild, embed, message.channel.id);
    } catch (err) {
        console.error("Timeout error:", err);
        return replyEmbed(message, { type: "error", title: "❌ Timeout Failed", description: "Failed to timeout that user." });
    }
}

export async function doUntimeout(message, target) {
    const v = validateModAction({ executor: message.member, target, action: "untimeout" });
    if (!v.ok) return replyEmbed(message, { type: "error", title: "❌ Cannot Untimeout", description: v.reason });

    try {
        const caseNumber = await createCase({ guild: message.guild, action: "untimeout", target: target.user, executor: message.author });

        await trySendModDM({
            user: target.user,
            guild: message.guild,
            type: "success",
            title: "✅ Timeout removed",
            description: "Your timeout has been removed.",
            moderatorTag: message.author.tag,
            caseNumber,
        });
        await target.timeout(null, `${message.author.tag}: Timeout removed`);

        const embed = buildModEmbed({
            guild: message.guild, type: "success", title: "✅ Timeout Removed",
            target, executor: message.author, caseNumber,
        });
        await message.reply({ embeds: [embed] });
        await postCase(message.guild, embed, message.channel.id);
    } catch (err) {
        console.error("Untimeout error:", err);
        return replyEmbed(message, { type: "error", title: "❌ Failed", description: "Failed to remove timeout." });
    }
}

// Re-export legacy helper signature
export { buildModEmbed };
