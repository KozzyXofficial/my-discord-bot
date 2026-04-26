import { safeRespond, parseDurationToMs } from "../../utils/helpers.js";
import { asEmbedPayload, buildCoolEmbed } from "../../utils/embeds.js";
import { addReminder, scheduleReminder } from "../../utils/reminders.js";

const MAX_REMIND_MS = 365 * 24 * 60 * 60 * 1000; // 1 year cap

export default {
    data: {
        name: "remind",
        description: "Set a reminder — DM you (or post in channel) when time is up",
        integration_types: [0, 1],
        contexts: [0, 1, 2],
        options: [
            { name: "time", description: "When? (e.g. 10m, 2h, 1d, 1w)", type: 3, required: true },
            { name: "what", description: "What should I remind you about?", type: 3, required: true }
        ]
    },
    async execute(i) {
        const timeStr = i.options.getString("time");
        const content = i.options.getString("what");

        const ms = parseDurationToMs(timeStr);
        if (!ms || ms <= 0) {
            return safeRespond(i, asEmbedPayload({
                guildId: i.guild?.id, type: "error",
                title: "❌ Invalid Time",
                description: "Use formats like `10m`, `2h`, `1d`, or `1w`.",
                ephemeral: true,
            }));
        }
        if (ms > MAX_REMIND_MS) {
            return safeRespond(i, asEmbedPayload({
                guildId: i.guild?.id, type: "error",
                title: "❌ Too Far Out",
                description: "Reminders cannot be set more than **1 year** in the future.",
                ephemeral: true,
            }));
        }
        if (content.length > 1000) {
            return safeRespond(i, asEmbedPayload({
                guildId: i.guild?.id, type: "error",
                title: "❌ Too Long",
                description: "Reminder content must be **1000** characters or fewer.",
                ephemeral: true,
            }));
        }

        const remindAt = Date.now() + ms;
        const channelId = i.channelId;
        const id = await addReminder(i.user.id, content, remindAt, channelId);
        scheduleReminder(i.client, { id, user_id: i.user.id, content, remind_at: remindAt, channel_id: channelId });

        const embed = buildCoolEmbed({
            guildId: i.guild?.id,
            type: "success",
            title: "⏰ Reminder Set",
            fields: [
                { name: "📝 Content", value: content.slice(0, 1024), inline: false },
                { name: "⏱️ When", value: `<t:${Math.floor(remindAt / 1000)}:F>\n(<t:${Math.floor(remindAt / 1000)}:R>)`, inline: true },
                { name: "🆔 Reminder ID", value: `\`${id}\``, inline: true },
            ],
            showAuthor: true,
            client: i.client,
        });

        embed.setFooter({
            text: `Requested by ${i.user.tag}`,
            iconURL: i.user.displayAvatarURL({ dynamic: true }),
        });

        return safeRespond(i, { embeds: [embed], ephemeral: true });
    }
};
