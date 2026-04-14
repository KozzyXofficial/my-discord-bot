import { PermissionsBitField } from "discord.js";
import { getGuildSettings, saveSettings } from "../../utils/database.js";
import { replyEmbed, permissionError } from "../../utils/embeds.js";

const PROTECTED_PREFIX = ["disable", "enable"];

export default {
    name: "disable",
    async execute(message, args, client) {
        if (!message.member.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
            return permissionError(message, "You need **Manage Server** to disable commands.");
        }

        const settings = getGuildSettings(message.guild.id);

        const sub = (args[0] || "").toLowerCase();

        // ── ,disable list ────────────────────────────────────────────────
        if (!sub || sub === "list") {
            const p = settings.disabledCommands.prefix;
            const s = settings.disabledCommands.slash;
            if (p.length === 0 && s.length === 0) {
                return replyEmbed(message, {
                    type: "info",
                    title: "🚫 Disabled Commands",
                    description: "No commands are disabled. Use `,disable prefix <name>` or `,disable slash <name>`.",
                });
            }
            const lines = [];
            if (p.length > 0) lines.push(`**Prefix**\n${p.sort().map(n => `• \`,${n}\``).join("\n")}`);
            if (s.length > 0) lines.push(`**Slash**\n${s.sort().map(n => `• \`/${n}\``).join("\n")}`);
            return replyEmbed(message, {
                type: "settings",
                title: "🚫 Disabled Commands",
                description: lines.join("\n\n"),
            });
        }

        const type = sub;
        const name = (args[1] || "").toLowerCase();

        if (type !== "prefix" && type !== "slash") {
            return replyEmbed(message, {
                type: "error",
                title: "❌ Usage",
                description:
                    "`,disable prefix <command>` — disable a prefix command\n" +
                    "`,disable slash <command>` — disable a slash command\n" +
                    "`,disable list` — show all disabled commands",
            });
        }

        if (!name) {
            return replyEmbed(message, { type: "error", title: "❌ Usage", description: `\`,disable ${type} <command name>\`` });
        }

        if (type === "prefix") {
            if (PROTECTED_PREFIX.includes(name)) {
                return replyEmbed(message, { type: "error", title: "⛔ Protected", description: `\`,${name}\` cannot be disabled.` });
            }
            if (!client.prefixCommands.has(name)) {
                return replyEmbed(message, { type: "error", title: "❌ Not Found", description: `No prefix command named \`,${name}\` exists.` });
            }
            if (settings.disabledCommands.prefix.includes(name)) {
                return replyEmbed(message, { type: "info", title: "ℹ️ Already Disabled", description: `\`,${name}\` is already disabled.` });
            }
            settings.disabledCommands.prefix.push(name);
            await saveSettings();
            return replyEmbed(message, { type: "settings", title: "🚫 Command Disabled", description: `\`,${name}\` is now disabled in this server.` });
        }

        if (type === "slash") {
            if (!client.slashCommands.has(name)) {
                return replyEmbed(message, { type: "error", title: "❌ Not Found", description: `No slash command named \`/${name}\` exists.` });
            }
            if (settings.disabledCommands.slash.includes(name)) {
                return replyEmbed(message, { type: "info", title: "ℹ️ Already Disabled", description: `\`/${name}\` is already disabled.` });
            }
            settings.disabledCommands.slash.push(name);
            await saveSettings();
            return replyEmbed(message, { type: "settings", title: "🚫 Command Disabled", description: `\`/${name}\` is now disabled in this server.` });
        }
    },
};
