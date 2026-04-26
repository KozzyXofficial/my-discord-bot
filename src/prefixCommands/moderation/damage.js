import { PermissionsBitField } from "discord.js";
import { doTimeout } from "../../utils/moderationUtils.js";
import { replyEmbed } from "../../utils/embeds.js";
import { parseDurationToMs } from "../../utils/helpers.js";

const MAX_TIMEOUT_MS = 28 * 24 * 60 * 60 * 1000; // 28 days, Discord limit

export default {
    name: "damage",
    async execute(message, args) {
        if (!message.member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) {
            return replyEmbed(message, {
                type: "error", title: "⛔ Permission Needed",
                description: "You need the **Timeout Members** permission.",
            });
        }
        const target = message.mentions.members.first();
        if (!target) {
            return replyEmbed(message, {
                type: "error", title: "❌ Usage",
                description: "`,damage @user <duration> [reason]`\nExamples: `10m`, `1h`, `1d`",
            });
        }

        const nonMention = args.filter(a => !a.startsWith("<@"));
        const timeArg = nonMention[0];
        if (!timeArg) {
            return replyEmbed(message, {
                type: "error", title: "❌ Missing Duration",
                description: "Provide a duration like `10m`, `1h`, or `1d`.",
            });
        }

        const ms = parseDurationToMs(timeArg);
        if (ms === null || ms === 0) {
            return replyEmbed(message, {
                type: "error", title: "❌ Invalid Duration",
                description: "Time must be like `10m`, `1h`, `1d`.",
            });
        }
        if (ms > MAX_TIMEOUT_MS) {
            return replyEmbed(message, {
                type: "error", title: "❌ Too Long",
                description: "Discord's maximum timeout is **28 days**.",
            });
        }

        const reason = nonMention.slice(1).join(" ") || "No reason provided.";
        return doTimeout(message, target, ms, reason);
    }
};
