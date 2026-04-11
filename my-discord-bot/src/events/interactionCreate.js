import { Events } from "discord.js";
import { safeRespond } from "../utils/helpers.js";
import { asEmbedPayload } from "../utils/embeds.js";

// Static imports for button handlers
import { sendPagedHelp } from "../slashCommands/general/help.js";
import { sendModHelpPage } from "../slashCommands/general/modhelp.js";
import { sendFeatureHelpPage } from "../slashCommands/general/features.js";
import { createTicketChannel, closeTicketByStaff } from "../utils/ticketUtils.js";

export default {
    name: Events.InteractionCreate,
    async execute(interaction, client) {
        // --- SLASH COMMANDS ---
        if (interaction.isChatInputCommand()) {
            const cmdName = interaction.commandName;
            const command = client.slashCommands.get(cmdName);

            if (!command) {
                return safeRespond(interaction, {
                    content: `❌ Command \`${cmdName}\` not found internally.`,
                    ephemeral: true
                });
            }

            try {
                await command.execute(interaction);
            } catch (error) {
                console.error(`[Interaction] ❌ Execution failed for '${cmdName}':`, error);
                await safeRespond(interaction, {
                    content: `❌ An internal error occurred while executing \`${cmdName}\`.`,
                    ephemeral: true
                });
            }
            return;
        }

        // --- BUTTONS ---
        if (interaction.isButton()) {
            const [action, ...args] = interaction.customId.split(":");
            console.log(`[Interaction] Button: ${interaction.customId}`);

            try {
                // Help Pagination
                if (action === "help_next" || action === "help_prev") {
                    const category = args[0];
                    const currentPage = parseInt(args[1]);
                    const newPage = (action === "help_next") ? currentPage + 1 : currentPage - 1;
                    return await sendPagedHelp(interaction, category, newPage);
                }

                // ModHelp Pagination
                if (action === "modhelp_next" || action === "modhelp_prev") {
                    const currentPage = parseInt(args[0]);
                    const newPage = (action === "modhelp_next") ? currentPage + 1 : currentPage - 1;
                    return await sendModHelpPage(interaction, newPage);
                }

                // Features Pagination
                if (action === "features_next" || action === "features_prev") {
                    const currentPage = parseInt(args[0]);
                    const newPage = (action === "features_next") ? currentPage + 1 : currentPage - 1;
                    return await sendFeatureHelpPage(interaction, newPage);
                }

                // Ticket System
                if (action === "ticket_open") {
                    return await createTicketChannel(interaction, args[0]);
                }
                if (action === "ticket_close") {
                    return await closeTicketByStaff(interaction);
                }

            } catch (error) {
                console.error(`[Interaction] ❌ Button failed (${interaction.customId}):`, error);
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply({ content: "❌ Error processing button.", ephemeral: true }).catch(() => { });
                }
            }
        }
    }
};
