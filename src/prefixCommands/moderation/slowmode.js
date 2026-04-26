import { PermissionsBitField } from "discord.js";
import { replyEmbed, buildCoolEmbed } from "../../utils/embeds.js";
import { parseDurationToMs } from "../../utils/helpers.js";

const MAX_SLOWMODE = 21600; // 6 hours, Discord limit

export default {
    name: "slowmode",
    async execute(message, args) {
        if (!message.member.permissions.has(PermissionsBitField.Flags.ManageChannels)) {
            return replyEmbed(message, {
                type: "error", title: "⛔ Permission Needed",
                description: "You need **Manage Channels** to change slowmode.",
            });
        }

        const targetChannel = message.mentions.channels.first() || message.channel;
        if (!targetChannel?.isTextBased()) {
            return replyEmbed(message, {
                type: "error", title: "❌ Invalid Channel",
                description: "Slowmode can only be set on text channels.",
            });
        }

        const rawArgs = message.mentions.channels.first() ? args.slice(1) : args;
        const amountStr = rawArgs[0];
        if (!amountStr) {
            return replyEmbed(message, {
                type: "error", title: "❌ Usage",
                description: "`,slowmode [#channel] <seconds|duration|off>`\nExamples: `30`, `2m`, `1h`, `off`",
            });
        }

        let seconds = 0;
        if (!["off", "0", "disable", "none"].includes(amountStr.toLowerCase())) {
            // Try parsing as duration first (e.g. "2m", "1h"), fall back to integer seconds
            const ms = parseDurationToMs(amountStr);
            if (ms !== null && ms > 0) {
                seconds = Math.floor(ms / 1000);
            } else {
                seconds = parseInt(amountStr, 10);
            }
            if (!Number.isFinite(seconds) || seconds < 0) {
                return replyEmbed(message, {
                    type: "error", title: "❌ Invalid",
                    description: "Provide a valid number of seconds or duration.",
                });
            }
            if (seconds > MAX_SLOWMODE) {
                return replyEmbed(message, {
                    type: "error", title: "❌ Too High",
                    description: `Slowmode cannot exceed **${MAX_SLOWMODE}s** (6 hours).`,
                });
            }
        }

        try {
            await targetChannel.setRateLimitPerUser(seconds, `Changed by ${message.author.tag}`);
        } catch {
            return replyEmbed(message, {
                type: "error", title: "❌ Failed",
                description: "I don't have permission to set slowmode here.",
            });
        }

        const embed = buildCoolEmbed({
            guildId: message.guild.id,
            type: "settings",
            title: "⏱️ Slowmode Updated",
            fields: [
                { name: "📁 Channel", value: `${targetChannel}`, inline: true },
                { name: "⏱️ Slowmode", value: seconds === 0 ? "**Disabled**" : `**${seconds}s**`, inline: true },
                { name: "👮 Moderator", value: `${message.author}`, inline: true },
            ],
            showAuthor: false,
            showFooter: true,
            footerText: message.guild.name,
        });

        return message.reply({ embeds: [embed] });
    }
};
