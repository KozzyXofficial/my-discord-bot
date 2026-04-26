import { PermissionsBitField } from "discord.js";
import { getGuildSettings, saveSettings } from "../../utils/database.js";
import { replyEmbed, buildCoolEmbed } from "../../utils/embeds.js";

const ACTION_LABEL = {
    timeout: "⏱️ Timeout",
    kick: "👢 Kick",
    ban: "🔨 Ban",
};

export default {
    name: "warnthreshold",
    async execute(message, args) {
        if (!message.member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) {
            return replyEmbed(message, {
                type: "error", title: "⛔ Permission Needed",
                description: "You need the **Timeout Members** permission.",
            });
        }
        const sub = (args[0] || "").toLowerCase();
        const settings = getGuildSettings(message.guild.id);
        settings.warnThresholds = settings.warnThresholds || [];

        if (sub === "add") {
            const count = parseInt(args[1], 10);
            const action = String(args[2] || "").toLowerCase();
            const time = parseInt(args[3] || "0", 10);

            if (!Number.isFinite(count) || count <= 0) {
                return replyEmbed(message, { type: "error", title: "❌ Invalid Count", description: "Count must be a positive number." });
            }
            if (!["timeout", "kick", "ban"].includes(action)) {
                return replyEmbed(message, { type: "error", title: "❌ Invalid Action", description: "Action must be `timeout`, `kick`, or `ban`." });
            }
            if (action === "timeout" && (!Number.isFinite(time) || time <= 0)) {
                return replyEmbed(message, { type: "error", title: "❌ Missing Time", description: "Timeout requires a duration in minutes." });
            }
            if (settings.warnThresholds.some(t => t.count === count)) {
                return replyEmbed(message, { type: "error", title: "❌ Duplicate", description: `A threshold for **${count}** warns already exists. Remove it first.` });
            }

            settings.warnThresholds.push({ count, action, time });
            settings.warnThresholds.sort((a, b) => a.count - b.count);
            await saveSettings();

            return replyEmbed(message, {
                type: "settings",
                title: "✅ Threshold Added",
                description: `When a member reaches **${count}** warns → **${ACTION_LABEL[action]}**${action === "timeout" ? ` for **${time}m**` : ""}.`,
            });
        }

        if (sub === "remove") {
            const count = parseInt(args[1], 10);
            const before = settings.warnThresholds.length;
            settings.warnThresholds = settings.warnThresholds.filter(t => t.count !== count);
            if (settings.warnThresholds.length === before) {
                return replyEmbed(message, { type: "error", title: "❌ Not Found", description: `No threshold for **${count}** warns.` });
            }
            await saveSettings();
            return replyEmbed(message, {
                type: "settings", title: "🧹 Threshold Removed",
                description: `Removed threshold for **${count}** warns.`,
            });
        }

        if (sub === "list" || sub === "") {
            if (!settings.warnThresholds.length) {
                return replyEmbed(message, {
                    type: "info", title: "⚠️ No Thresholds Set",
                    description: "Use `,warnthreshold add <count> <action> [minutes]` to add one.",
                });
            }

            const lines = settings.warnThresholds.map(t =>
                `**${t.count}** warns → ${ACTION_LABEL[t.action]}${t.action === "timeout" ? ` for **${t.time}m**` : ""}`
            );

            const embed = buildCoolEmbed({
                guildId: message.guild.id,
                type: "info",
                title: "⚠️ Warn Thresholds",
                description: lines.join("\n"),
                showAuthor: true,
                showFooter: true,
                footerText: `${settings.warnThresholds.length} threshold(s)`,
                client: message.client,
            });
            return message.reply({ embeds: [embed] });
        }

        return replyEmbed(message, {
            type: "error", title: "❌ Usage",
            description: "`,warnthreshold add <count> <timeout|kick|ban> [minutes]`\n`,warnthreshold remove <count>`\n`,warnthreshold list`",
        });
    }
};
