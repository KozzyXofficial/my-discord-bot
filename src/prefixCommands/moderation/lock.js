import { PermissionsBitField } from "discord.js";
import { replyEmbed, buildCoolEmbed, postCase } from "../../utils/embeds.js";

export default {
    name: "lock",
    async execute(message, args) {
        if (!message.member.permissions.has(PermissionsBitField.Flags.ManageChannels)) {
            return replyEmbed(message, {
                type: "error", title: "⛔ Permission Needed",
                description: "You need **Manage Channels** to lock channels.",
            });
        }

        const targetChannel = message.mentions.channels.first() || message.channel;
        if (!targetChannel?.isTextBased()) {
            return replyEmbed(message, {
                type: "error", title: "❌ Invalid Channel",
                description: "Lock can only be used on text channels.",
            });
        }

        const everyone = message.guild.roles.everyone;
        const current = targetChannel.permissionsFor(everyone);
        if (current && !current.has(PermissionsBitField.Flags.SendMessages)) {
            return replyEmbed(message, {
                type: "info", title: "🔒 Already Locked",
                description: `${targetChannel} is already locked for @everyone.`,
            });
        }

        const reasonArgs = message.mentions.channels.first() ? args.slice(1) : args;
        const reason = reasonArgs.join(" ") || "No reason provided.";

        try {
            await targetChannel.permissionOverwrites.edit(everyone, { SendMessages: false }, {
                reason: `Locked by ${message.author.tag}: ${reason}`,
            });
        } catch {
            return replyEmbed(message, {
                type: "error", title: "❌ Lock Failed",
                description: "I don't have permission to edit that channel.",
            });
        }

        const embed = buildCoolEmbed({
            guildId: message.guild.id,
            type: "mod",
            title: "🔒 Channel Locked",
            fields: [
                { name: "📁 Channel", value: `${targetChannel}`, inline: true },
                { name: "👮 Moderator", value: `${message.author}`, inline: true },
                { name: "📝 Reason", value: reason, inline: false },
            ],
            showAuthor: false,
            showFooter: true,
            footerText: message.guild.name,
        });

        await message.reply({ embeds: [embed] });
        await postCase(message.guild, embed, message.channel.id);
    }
};
