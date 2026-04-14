import { PermissionsBitField } from "discord.js";
import { getGuildSettings, saveSettings } from "../../utils/database.js";
import { replyEmbed, permissionError } from "../../utils/embeds.js";

export default {
    name: "enable",
    async execute(message, args, client) {
        if (!message.member.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
            return permissionError(message, "You need **Manage Server** to enable commands.");
        }

        const settings = getGuildSettings(message.guild.id);

        const type = (args[0] || "").toLowerCase();
        const name = (args[1] || "").toLowerCase();

        if ((type !== "prefix" && type !== "slash") || !name) {
            return replyEmbed(message, {
                type: "error",
                title: "❌ Usage",
                description:
                    "`,enable prefix <command>` — re-enable a prefix command\n" +
                    "`,enable slash <command>` — re-enable a slash command",
            });
        }

        if (type === "prefix") {
            if (!settings.disabledCommands.prefix.includes(name)) {
                return replyEmbed(message, { type: "info", title: "ℹ️ Not Disabled", description: `\`,${name}\` is not disabled.` });
            }
            settings.disabledCommands.prefix = settings.disabledCommands.prefix.filter(n => n !== name);
            await saveSettings();
            return replyEmbed(message, { type: "success", title: "✅ Command Enabled", description: `\`,${name}\` is now enabled in this server.` });
        }

        if (type === "slash") {
            if (!settings.disabledCommands.slash.includes(name)) {
                return replyEmbed(message, { type: "info", title: "ℹ️ Not Disabled", description: `\`/${name}\` is not disabled.` });
            }
            settings.disabledCommands.slash = settings.disabledCommands.slash.filter(n => n !== name);
            await saveSettings();
            return replyEmbed(message, { type: "success", title: "✅ Command Enabled", description: `\`/${name}\` is now enabled in this server.` });
        }
    },
};
