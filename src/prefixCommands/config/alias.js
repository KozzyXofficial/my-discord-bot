import { PermissionsBitField } from "discord.js";
import { getGuildSettings, saveSettings } from "../../utils/database.js";
import { replyEmbed, permissionError } from "../../utils/embeds.js";

const VALID_NAME = /^[a-z0-9_]{1,32}$/i;

function resolveCanonical(input, client) {
    const name = input.toLowerCase();
    if (client.prefixCommands.has(name)) return name;
    const viaBuiltinAlias = client.aliases.get(name);
    if (viaBuiltinAlias && client.prefixCommands.has(viaBuiltinAlias)) return viaBuiltinAlias;
    return null;
}

function usageEmbed(message) {
    return replyEmbed(message, {
        type: "error",
        title: "❌ Usage",
        description:
            "`,alias add <command> <alias>` — add a custom name for a command\n" +
            "`,alias remove <alias>` — remove a custom alias\n" +
            "`,alias reset <command>` — clear all aliases for a command\n" +
            "`,alias reset all` — clear every custom alias\n" +
            "`,alias list` — show all custom aliases",
    });
}

export default {
    name: "alias",
    async execute(message, args, client) {
        if (!message.member.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
            return permissionError(message, "You need **Manage Server** to customize command names.");
        }

        const settings = getGuildSettings(message.guild.id);
        settings.commandAliases = settings.commandAliases || {};

        const sub = (args[0] || "").toLowerCase();

        // ── ,alias list ──────────────────────────────────────────────────
        if (!sub || sub === "list") {
            const entries = Object.entries(settings.commandAliases);
            if (entries.length === 0) {
                return replyEmbed(message, {
                    type: "info",
                    title: "🔤 Command Aliases",
                    description: "No custom aliases set. Use `,alias add <command> <alias>` to create one.",
                });
            }
            const byCanon = {};
            for (const [alias, canon] of entries) (byCanon[canon] ||= []).push(alias);
            const lines = Object.entries(byCanon)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([canon, aliases]) => `**\`,${canon}\`** → ${aliases.sort().map(a => `\`,${a}\``).join(", ")}`);
            return replyEmbed(message, {
                type: "settings",
                title: "🔤 Command Aliases",
                description: lines.join("\n"),
            });
        }

        // ── ,alias add <command> <alias> ─────────────────────────────────
        if (sub === "add") {
            const cmdInput = args[1];
            const aliasInput = args[2];
            if (!cmdInput || !aliasInput) {
                return replyEmbed(message, { type: "error", title: "❌ Usage", description: "`,alias add <command> <alias>`" });
            }
            const canonical = resolveCanonical(cmdInput, client);
            if (!canonical) {
                return replyEmbed(message, { type: "error", title: "❌ Unknown Command", description: `No prefix command named \`${cmdInput}\` exists.` });
            }
            const alias = aliasInput.toLowerCase();
            if (!VALID_NAME.test(alias)) {
                return replyEmbed(message, { type: "error", title: "❌ Invalid Alias", description: "Alias must be 1–32 characters and contain only letters, digits, or underscores." });
            }
            if (alias.startsWith("embed_")) {
                return replyEmbed(message, { type: "error", title: "❌ Reserved", description: "Aliases starting with `embed_` are reserved for embed color commands." });
            }
            if (client.prefixCommands.has(alias)) {
                return replyEmbed(message, { type: "error", title: "❌ Conflict", description: `\`,${alias}\` is already a built-in command name.` });
            }
            if (client.aliases.has(alias)) {
                return replyEmbed(message, { type: "error", title: "❌ Conflict", description: `\`,${alias}\` is already a built-in alias.` });
            }
            const existing = settings.commandAliases[alias];
            if (existing === canonical) {
                return replyEmbed(message, { type: "info", title: "ℹ️ No Change", description: `\`,${alias}\` is already an alias for \`,${canonical}\`.` });
            }
            if (existing) {
                return replyEmbed(message, { type: "error", title: "❌ Conflict", description: `\`,${alias}\` is already an alias for \`,${existing}\`. Remove it first.` });
            }
            settings.commandAliases[alias] = canonical;
            await saveSettings();
            return replyEmbed(message, {
                type: "settings",
                title: "✅ Alias Added",
                description: `\`,${alias}\` will now run \`,${canonical}\`.`,
            });
        }

        // ── ,alias remove <alias> ────────────────────────────────────────
        if (sub === "remove") {
            const aliasInput = args[1];
            if (!aliasInput) {
                return replyEmbed(message, { type: "error", title: "❌ Usage", description: "`,alias remove <alias>`" });
            }
            const alias = aliasInput.toLowerCase();
            const canonical = settings.commandAliases[alias];
            if (!canonical) {
                return replyEmbed(message, { type: "error", title: "❌ Not Found", description: `\`,${alias}\` is not a custom alias.` });
            }
            delete settings.commandAliases[alias];
            await saveSettings();
            return replyEmbed(message, {
                type: "settings",
                title: "✅ Alias Removed",
                description: `\`,${alias}\` no longer runs \`,${canonical}\`.`,
            });
        }

        // ── ,alias reset <command|all> ───────────────────────────────────
        if (sub === "reset") {
            const target = (args[1] || "").toLowerCase();
            if (!target) {
                return replyEmbed(message, { type: "error", title: "❌ Usage", description: "`,alias reset <command>` or `,alias reset all`" });
            }
            if (target === "all") {
                const count = Object.keys(settings.commandAliases).length;
                if (count === 0) {
                    return replyEmbed(message, { type: "info", title: "ℹ️ Nothing to Reset", description: "No custom aliases are set." });
                }
                settings.commandAliases = {};
                await saveSettings();
                return replyEmbed(message, { type: "settings", title: "✅ Aliases Cleared", description: `Removed **${count}** custom alias(es).` });
            }
            const canonical = resolveCanonical(target, client);
            if (!canonical) {
                return replyEmbed(message, { type: "error", title: "❌ Unknown Command", description: `No prefix command named \`${target}\` exists.` });
            }
            const removed = [];
            for (const [alias, canon] of Object.entries(settings.commandAliases)) {
                if (canon === canonical) {
                    removed.push(alias);
                    delete settings.commandAliases[alias];
                }
            }
            if (removed.length === 0) {
                return replyEmbed(message, { type: "info", title: "ℹ️ Nothing to Reset", description: `\`,${canonical}\` has no custom aliases.` });
            }
            await saveSettings();
            return replyEmbed(message, {
                type: "settings",
                title: "✅ Aliases Cleared",
                description: `Removed ${removed.map(a => `\`,${a}\``).join(", ")} from \`,${canonical}\`.`,
            });
        }

        return usageEmbed(message);
    },
};
