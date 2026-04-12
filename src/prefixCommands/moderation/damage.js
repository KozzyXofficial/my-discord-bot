import { PermissionsBitField } from "discord.js";
import { doTimeout } from "../../utils/moderationUtils.js";
import { replyEmbed, permissionError } from "../../utils/embeds.js";
import { parseDurationToMs } from "../../utils/helpers.js";

export default {
    name: "damage",
    async execute(message, args) {
        if (!message.member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) {
            return permissionError(message, "You need **Timeout Members** permission.");
        }
        const target = message.mentions.members.first();
        if (!target) return replyEmbed(message, { type: "error", title: "❌ Usage", description: "`,damage @user <time> [reason]` (e.g. 10m, 1h)" });
        const timeArg = args.find(a => !a.startsWith("<@") && parseDurationToMs(a) !== null);
        const ms = parseDurationToMs(timeArg || "10m");
        if (ms === null || ms === 0) return replyEmbed(message, { type: "error", title: "❌ Invalid Time", description: "Time must be like `10m`, `1h`, `1d`." });
        const reason = args.filter(a => !a.match(/^<@!?\d+>$/) && a !== timeArg).join(" ") || "No reason provided.";
        return doTimeout(message, target, ms, reason);
    }
};
