import { PermissionsBitField } from "discord.js";
import { safeRespond } from "../../utils/helpers.js";
import { asEmbedPayload } from "../../utils/embeds.js";
import { getGuildSettings } from "../../utils/database.js";
import { checkRaid, primeSimulation, makeFakeMember } from "../../utils/raidProtection.js";

export default {
    data: {
        name: "antiraid",
        description: "Anti-raid tools and simulation",
        default_member_permissions: String(PermissionsBitField.Flags.ManageGuild),
        dm_permission: false,
        options: [
            {
                name: "test",
                description: "Simulate a join spike to verify the anti-raid system fires correctly",
                type: 1,
                options: [
                    {
                        name: "count",
                        description: "Number of fake accounts to simulate (default: uses your configured threshold)",
                        type: 4,
                        required: false,
                        min_value: 2,
                        max_value: 50,
                    },
                ],
            },
        ],
    },

    async execute(interaction) {
        if (!interaction.guildId) return;
        const sub = interaction.options.getSubcommand();

        if (sub === "test") {
            const settings = getGuildSettings(interaction.guildId);
            if (!settings.plugins?.anti_raid) {
                return safeRespond(interaction, asEmbedPayload({
                    guildId: interaction.guildId, type: "error",
                    title: "❌ Anti-Raid Disabled",
                    description: "Enable the plugin first with `/plugins enable Anti-Raid`.",
                    ephemeral: true,
                }));
            }

            const cfg = settings.antiRaid ?? {};
            const threshold = cfg.threshold ?? 10;
            const count = interaction.options.getInteger("count") ?? threshold;
            const action = cfg.action ?? "lockdown";

            await interaction.deferReply({ ephemeral: true });

            // Pre-fill the join window with (count - 1) fake entries, then fire
            // one real checkRaid call to push it over threshold.
            primeSimulation(interaction.guildId, count);
            const fakeMember = makeFakeMember(interaction.guild, count);
            await checkRaid(fakeMember);

            return safeRespond(interaction, asEmbedPayload({
                guildId: interaction.guildId, type: "warning",
                title: "🧪 Simulation Fired",
                description: `Simulated **${count}** fake accounts joining — raid detection should have triggered.`,
                fields: [
                    { name: "🛡️ Configured Action", value: `\`${action.toUpperCase()}\``, inline: true },
                    { name: "🎯 Threshold", value: `${threshold} joins`, inline: true },
                    { name: "💡 Recovery", value: action === "lockdown" ? "Use `,unraid` to lift the lockdown." : "No real accounts were affected.", inline: false },
                ],
                ephemeral: true,
            }));
        }
    },
};
