import { PermissionsBitField } from "discord.js";
import { replyEmbed, asEmbedPayload } from "../../utils/embeds.js";

const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;

export default {
    name: "clear",
    async execute(message, args) {
        if (!message.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
            return replyEmbed(message, {
                type: "error", title: "⛔ Permission Needed",
                description: "You need **Manage Messages** to clear messages.",
            });
        }

        const filterUser = message.mentions.users.first();
        const numericArgs = args.filter(a => !a.startsWith("<@"));
        const amount = parseInt(numericArgs[0], 10);

        if (!Number.isFinite(amount) || amount < 1 || amount > 100) {
            return replyEmbed(message, {
                type: "error", title: "❌ Usage",
                description: "`,clear <amount>` (1–100)\n`,clear <amount> @user` to filter by author",
            });
        }

        try {
            let deleted = 0;
            if (filterUser) {
                const fetched = await message.channel.messages.fetch({ limit: 100, before: message.id });
                const cutoff = Date.now() - FOURTEEN_DAYS_MS;
                const targets = fetched
                    .filter(m => m.author.id === filterUser.id && m.createdTimestamp > cutoff)
                    .first(amount);
                if (targets.length) {
                    const result = await message.channel.bulkDelete(targets, true);
                    deleted = result.size;
                }
                await message.delete().catch(() => {});
            } else {
                const result = await message.channel.bulkDelete(amount + 1, true);
                deleted = Math.max(0, result.size - 1); // subtract the command message itself
            }

            const infoMsg = await message.channel.send(asEmbedPayload({
                guildId: message.guild.id,
                type: "success",
                title: "🧹 Messages Cleared",
                description: filterUser
                    ? `Cleared **${deleted}** message(s) from ${filterUser}.`
                    : `Cleared **${deleted}** message(s).`,
                footerUser: message.author,
                client: message.client,
            }));
            setTimeout(() => infoMsg.delete().catch(() => {}), 5000);
        } catch (err) {
            console.error("Clear error:", err);
            return replyEmbed(message, {
                type: "error", title: "❌ Clear Failed",
                description: "Failed to clear messages. Discord won't bulk delete messages older than 14 days.",
            });
        }
    }
};
