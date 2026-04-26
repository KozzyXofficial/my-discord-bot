import { PermissionsBitField, ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import { safeRespond } from "../../utils/helpers.js";
import { asEmbedPayload, buildCoolEmbed } from "../../utils/embeds.js";

const CONFIRM_THRESHOLD = 50;

async function nukeChannel(channel, target) {
    let deleted = 0;
    while (deleted < target) {
        const batchSize = Math.min(100, target - deleted);
        const fetched = await channel.messages.fetch({ limit: batchSize });
        if (fetched.size === 0) break;

        const bulk = await channel.bulkDelete(fetched, true).catch(() => null);
        const count = bulk?.size ?? 0;
        deleted += count;
        if (count < fetched.size || count === 0) break;
        if (deleted < target) await new Promise(r => setTimeout(r, 1000));
    }
    return deleted;
}

export default {
    data: {
        name: "nuke",
        description: "Bulk-delete messages from this channel",
        default_member_permissions: String(PermissionsBitField.Flags.ManageMessages),
        dm_permission: false,
        options: [
            {
                name: "amount",
                description: "Number of messages to delete (1–1000). Omit to delete ALL.",
                type: 4,
                required: false,
                min_value: 1,
                max_value: 1000,
            },
        ],
    },

    async execute(interaction) {
        const channel = interaction.channel;
        const amount = interaction.options.getInteger("amount");

        const me = interaction.guild.members.me;
        if (!me.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
            return safeRespond(interaction, asEmbedPayload({
                guildId: interaction.guildId, type: "error",
                title: "❌ Bot Missing Permission",
                description: "I need **Manage Messages** to do this.",
                ephemeral: true,
            }));
        }

        const target = amount ?? Infinity;
        const isLarge = !amount || amount > CONFIRM_THRESHOLD;

        // ── Confirmation gate for large or "all" deletes
        if (isLarge) {
            const confirmId = `nuke_confirm_${interaction.user.id}_${Date.now()}`;
            const cancelId = `nuke_cancel_${interaction.user.id}_${Date.now()}`;

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(confirmId).setLabel("💥 Confirm Nuke").setStyle(ButtonStyle.Danger),
                new ButtonBuilder().setCustomId(cancelId).setLabel("Cancel").setStyle(ButtonStyle.Secondary),
            );

            const reply = await interaction.reply({
                ephemeral: true,
                embeds: [buildCoolEmbed({
                    guildId: interaction.guildId,
                    type: "warning",
                    title: "⚠️ Confirm Channel Nuke",
                    description: amount
                        ? `You are about to delete up to **${amount}** messages from ${channel}.`
                        : `You are about to delete **ALL messages** from ${channel} (subject to Discord's 14-day bulk-delete limit).`,
                    fields: [
                        { name: "📁 Channel", value: `${channel}`, inline: true },
                        { name: "🎯 Target", value: amount ? `${amount} messages` : "All messages", inline: true },
                    ],
                    showAuthor: false,
                    showFooter: true,
                    footerText: "This cannot be undone. Confirm within 30 seconds.",
                })],
                components: [row],
                fetchReply: true,
            });

            try {
                const btn = await reply.awaitMessageComponent({
                    filter: i => i.user.id === interaction.user.id && (i.customId === confirmId || i.customId === cancelId),
                    time: 30_000,
                });

                if (btn.customId === cancelId) {
                    return btn.update({
                        embeds: [buildCoolEmbed({
                            guildId: interaction.guildId, type: "info",
                            title: "❎ Cancelled",
                            description: "Nuke cancelled — no messages were deleted.",
                        })],
                        components: [],
                    });
                }

                await btn.update({
                    embeds: [buildCoolEmbed({
                        guildId: interaction.guildId, type: "warning",
                        title: "⏳ Nuking...",
                        description: "Deleting messages, please wait.",
                    })],
                    components: [],
                });

                const deleted = await nukeChannel(channel, target);

                return interaction.editReply({
                    embeds: [buildCoolEmbed({
                        guildId: interaction.guildId,
                        type: "success",
                        title: "💥 Nuked",
                        fields: [
                            { name: "📁 Channel", value: `${channel}`, inline: true },
                            { name: "🗑️ Deleted", value: `**${deleted}** messages`, inline: true },
                        ],
                        showAuthor: false,
                        showFooter: true,
                        footerText: "Discord won't bulk-delete messages older than 14 days.",
                    })],
                });
            } catch {
                return interaction.editReply({
                    embeds: [buildCoolEmbed({
                        guildId: interaction.guildId, type: "info",
                        title: "⏰ Timed Out",
                        description: "Confirmation expired — no messages were deleted.",
                    })],
                    components: [],
                }).catch(() => {});
            }
        }

        // ── Small delete: no confirmation
        await interaction.deferReply({ ephemeral: true });
        const deleted = await nukeChannel(channel, target);

        return safeRespond(interaction, asEmbedPayload({
            guildId: interaction.guildId,
            type: "success",
            title: "💥 Nuked",
            fields: [
                { name: "📁 Channel", value: `${channel}`, inline: true },
                { name: "🗑️ Deleted", value: `**${deleted}** messages`, inline: true },
            ],
        }));
    },
};
