import { PermissionsBitField } from "discord.js";
import { doSoftban } from "../../utils/moderationUtils.js";
import { replyEmbed } from "../../utils/embeds.js";

export default {
    name: "softban",
    async execute(message, args) {
        if (!message.member.permissions.has(PermissionsBitField.Flags.BanMembers)) {
            return replyEmbed(message, {
                type: "error",
                title: "⛔ Permission Needed",
                description: "You need the **Ban Members** permission to use this command.",
            });
        }

        const target = message.mentions.users.first()
            || (args[0] && /^\d{16,21}$/.test(args[0]) ? await message.client.users.fetch(args[0]).catch(() => null) : null);

        if (!target) {
            return replyEmbed(message, {
                type: "error",
                title: "❌ Usage",
                description: "`,softban @user [reason]`\n*Bans, deletes 7 days of messages, then unbans — user can rejoin via invite.*",
            });
        }

        const reason = args.slice(1).join(" ").replace(/<@!?\d+>/g, "").trim() || "No reason provided.";
        return doSoftban(message, target, reason);
    }
};
