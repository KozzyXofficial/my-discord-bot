import { PermissionsBitField } from "discord.js";
import { doKick } from "../../utils/moderationUtils.js";
import { replyEmbed } from "../../utils/embeds.js";

export default {
    name: "kick",
    async execute(message, args) {
        if (!message.member.permissions.has(PermissionsBitField.Flags.KickMembers)) {
            return replyEmbed(message, {
                type: "error",
                title: "⛔ Permission Needed",
                description: "You need the **Kick Members** permission to use this command.",
            });
        }

        const target = message.mentions.members.first();
        if (!target) {
            return replyEmbed(message, {
                type: "error",
                title: "❌ Usage",
                description: "`,kick @user [reason]`",
            });
        }

        const reason = args.slice(1).join(" ").replace(/<@!?\d+>/g, "").trim() || "No reason provided.";
        return doKick(message, target, reason);
    }
};
