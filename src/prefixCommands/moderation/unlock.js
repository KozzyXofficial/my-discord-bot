import { PermissionsBitField } from "discord.js";
import { replyEmbed, buildCoolEmbed, postCase } from "../../utils/embeds.js";

export default {
    name: "unlock",
    async execute(message, args) {
        if (!message.member.permissions.has(PermissionsBitField.Flags.ManageChannels)) {
            return replyEmbed(message, {
                type: "error", title: "⛔ Permission Needed",
                description: "You need **Manage Channels** to unlock channels.",
            });
        }

        const targetChannel = message.mentions.channels.first() || message.channel;
        if (!targetChannel?.isTextBased()) {
            return replyEmbed(message, {
                type: "error", title: "❌ Invalid Channel",
                description: "Unlock can only be used on text channels.",
            });
        }

        const everyone = message.guild.roles.everyone;
        const current = targetChannel.permissionsFor(everyone);
        if (current && current.has(PermissionsBitField.Flags.SendMessages)) {
            return replyEmbed(message, {
                type: "info", title: "🔓 Already Unlocked",
                description: `${targetChannel} is not locked.`,
            });
        }

        try {
            await targetChannel.permissionOverwrites.edit(everyone, { SendMessages: null }, {
                reason: `Unlocked by ${message.author.tag}`,
            });
        } catch {
            return replyEmbed(message, {
                type: "error", title: "❌ Unlock Failed",
                description: "I don't have permission to edit that channel.",
            });
        }

        const embed = buildCoolEmbed({
            guildId: message.guild.id,
            type: "success",
            title: "🔓 Channel Unlocked",
            fields: [
                { name: "📁 Channel", value: `${targetChannel}`, inline: true },
                { name: "👮 Moderator", value: `${message.author}`, inline: true },
            ],
            showAuthor: false,
            showFooter: true,
            footerText: message.guild.name,
        });

        await message.reply({ embeds: [embed] });
        await postCase(message.guild, embed, message.channel.id);
    }
};
