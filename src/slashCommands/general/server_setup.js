// ========================================================================
//  /server_setup  —  One-shot server provisioning command
// ========================================================================
//  Creates roles, categories, channels, permission overwrites, and posts
//  pre-built welcome/rules embeds. Wires bot settings (case channel, ticket
//  panel channel) so every in-bot system works out of the box.
//
//  Presets (premade setup blueprints — pick one):
//    • full       — Full community server (roles + all categories)
//    • community  — Social / chat-focused layout
//    • gaming     — Gaming community with game chats + voice lounges
//    • minimal    — Small private server (one category, light roles)
//    • staff_only — Only staff tools (mod-log, case channel, staff chat)
//
//  Options:
//    • dry_run       — Preview actions without touching the server
//    • skip_existing — If a role/channel with the same name already exists
//                      (default: true), skip it instead of duplicating
// ========================================================================

import {
    ChannelType,
    PermissionFlagsBits,
    PermissionsBitField,
    EmbedBuilder,
} from "discord.js";
import { safeRespond } from "../../utils/helpers.js";
import { buildCoolEmbed, asEmbedPayload } from "../../utils/embeds.js";
import { getGuildSettings, saveSettings } from "../../utils/database.js";

// ---------- Permission aliases -----------------------------------------
const P = PermissionFlagsBits;

// Full administrator-esque bundle for staff roles
const STAFF_PERMS = [
    P.ViewChannel, P.SendMessages, P.ReadMessageHistory, P.EmbedLinks,
    P.AttachFiles, P.AddReactions, P.UseExternalEmojis,
    P.ManageMessages, P.KickMembers, P.BanMembers, P.ModerateMembers,
    P.ManageChannels, P.ManageRoles, P.MentionEveryone,
    P.MuteMembers, P.DeafenMembers, P.MoveMembers,
];

// Everyday member bundle
const MEMBER_PERMS = [
    P.ViewChannel, P.SendMessages, P.ReadMessageHistory, P.EmbedLinks,
    P.AttachFiles, P.AddReactions, P.UseExternalEmojis, P.Connect, P.Speak,
    P.Stream, P.UseVAD,
];

// ---------- Role blueprints --------------------------------------------
// Listed top→bottom (highest→lowest). Bot places them in that hierarchy.
const ROLE_BLUEPRINTS = {
    staff: [
        { name: "👑 Owner",     color: 0xFEE75C, hoist: true, mentionable: false, perms: [P.Administrator] },
        { name: "🛡️ Admin",     color: 0xED4245, hoist: true, mentionable: true,  perms: [P.Administrator] },
        { name: "⚔️ Moderator", color: 0xEB459E, hoist: true, mentionable: true,  perms: STAFF_PERMS },
        { name: "🧰 Helper",    color: 0x57F287, hoist: true, mentionable: true,
          perms: [P.ViewChannel, P.SendMessages, P.ManageMessages, P.ModerateMembers, P.ReadMessageHistory] },
    ],
    special: [
        { name: "💎 VIP",           color: 0x9B59B6, hoist: true, mentionable: true, perms: MEMBER_PERMS },
        { name: "💜 Booster",       color: 0xF47FFF, hoist: true, mentionable: true, perms: MEMBER_PERMS },
        { name: "⭐ Active Member", color: 0x1ABC9C, hoist: true, mentionable: true, perms: MEMBER_PERMS },
    ],
    base: [
        { name: "🧍 Member", color: 0x95A5A6, hoist: false, mentionable: false, perms: MEMBER_PERMS },
        { name: "🤖 Bots",   color: 0x2F3136, hoist: true,  mentionable: false, perms: MEMBER_PERMS },
        // Muted is the LAST role created but is special: we deny SendMessages server-wide via overwrites.
        { name: "🔇 Muted",  color: 0x4F545C, hoist: false, mentionable: false, perms: [] },
    ],
};

// ---------- Channel blueprints -----------------------------------------
// Each category lists { type, name, topic, readOnly?, staffOnly? }.
// "readOnly" means @everyone can view but not send (announcements/rules).
// "staffOnly" means only staff roles can view.
const CATEGORY_BLUEPRINTS = {
    information: {
        name: "📢 INFORMATION",
        channels: [
            { type: "text", name: "welcome",         topic: "👋 Welcome to the server!",         readOnly: true },
            { type: "text", name: "rules",           topic: "📜 Server rules — please read!",    readOnly: true },
            { type: "text", name: "announcements",   topic: "📣 Important server updates.",      readOnly: true },
            { type: "text", name: "server-updates",  topic: "🆕 Changelog and feature updates.", readOnly: true },
        ],
    },
    community: {
        name: "💬 COMMUNITY",
        channels: [
            { type: "text", name: "general",       topic: "💬 General chat. Be nice!" },
            { type: "text", name: "introductions", topic: "👋 Say hi! Introduce yourself." },
            { type: "text", name: "media",         topic: "🖼️ Share images, videos, and art." },
            { type: "text", name: "memes",         topic: "😂 Memes and funny content only." },
            { type: "text", name: "bot-commands",  topic: "🤖 Use bot commands here." },
        ],
    },
    gaming: {
        name: "🎮 GAMING",
        channels: [
            { type: "text", name: "lfg",          topic: "🔎 Looking for group / teammates." },
            { type: "text", name: "gaming-chat",  topic: "🎮 General gaming discussion." },
            { type: "text", name: "clips",        topic: "🎬 Your best clips and highlights." },
        ],
    },
    voice: {
        name: "🎧 VOICE",
        channels: [
            { type: "voice", name: "🔊 General Lounge" },
            { type: "voice", name: "🎵 Music" },
            { type: "voice", name: "🎮 Gaming VC" },
            { type: "voice", name: "😴 AFK" },
        ],
    },
    support: {
        name: "🎫 SUPPORT",
        channels: [
            { type: "text", name: "support",     topic: "🎫 Need help? Open a ticket here." },
            { type: "text", name: "suggestions", topic: "💡 Suggest ideas and improvements." },
            { type: "text", name: "bug-reports", topic: "🐛 Report bugs you've found." },
        ],
    },
    staff: {
        name: "🛠️ STAFF",
        staffOnly: true,
        channels: [
            { type: "text",  name: "staff-chat",  topic: "🛠️ Staff only chat.",              staffOnly: true },
            { type: "text",  name: "mod-log",     topic: "📝 Moderation action log.",         staffOnly: true },
            { type: "text",  name: "cases",       topic: "🧾 Case feed — for the bot.",       staffOnly: true },
            { type: "voice", name: "🛠️ Staff VC", staffOnly: true },
        ],
    },
};

// ---------- Preset blueprints ------------------------------------------
// Each preset lists which role groups and which categories to provision.
const PRESETS = {
    full: {
        label: "Full Community Server",
        description: "Everything: roles, info, community, voice, support, staff tools.",
        roleGroups: ["staff", "special", "base"],
        categories: ["information", "community", "voice", "support", "staff"],
    },
    community: {
        label: "Community / Chat Server",
        description: "Social-focused layout with info, chat, voice, and staff tools.",
        roleGroups: ["staff", "special", "base"],
        categories: ["information", "community", "voice", "staff"],
    },
    gaming: {
        label: "Gaming Community",
        description: "Gaming-focused layout with LFG, clips, gaming voice lounges.",
        roleGroups: ["staff", "special", "base"],
        categories: ["information", "community", "gaming", "voice", "staff"],
    },
    minimal: {
        label: "Minimal / Private Server",
        description: "Bare-bones setup — light roles, one category, one voice.",
        roleGroups: ["staff", "base"],
        categories: ["information", "community", "voice"],
    },
    staff_only: {
        label: "Staff Tools Only",
        description: "Only creates staff roles, a staff category, mod-log, case channel.",
        roleGroups: ["staff"],
        categories: ["staff"],
    },
};

// ========================================================================
//  MAIN COMMAND
// ========================================================================
export default {
    data: {
        name: "server_setup",
        description: "Provision roles, channels, and settings in one command.",
        // 0x20 = ManageGuild — only server managers can even see this command.
        default_member_permissions: String(PermissionsBitField.Flags.ManageGuild),
        dm_permission: false,
        options: [
            {
                name: "preset",
                description: "Which premade setup to use.",
                type: 3, // STRING
                required: true,
                choices: Object.entries(PRESETS).map(([k, v]) => ({
                    name: `${v.label}`,
                    value: k,
                })),
            },
            {
                name: "dry_run",
                description: "Preview what would be created without touching the server.",
                type: 5, // BOOLEAN
                required: false,
            },
            {
                name: "skip_existing",
                description: "Skip roles/channels that already exist by name (default: true).",
                type: 5, // BOOLEAN
                required: false,
            },
        ],
    },

    async execute(interaction) {
        const guild = interaction.guild;
        if (!guild) {
            return safeRespond(interaction, asEmbedPayload({
                guildId: null, type: "error",
                title: "❌ Server Only",
                description: "This command can only be used in a server.",
                ephemeral: true,
            }));
        }

        // --- Permission checks ---------------------------------------
        const invoker = interaction.member;
        if (!invoker?.permissions?.has(P.ManageGuild) && !invoker?.permissions?.has(P.Administrator)) {
            return safeRespond(interaction, asEmbedPayload({
                guildId: guild.id, type: "error",
                title: "❌ Insufficient Permissions",
                description: "You need the **Manage Server** permission to run this.",
                ephemeral: true,
            }));
        }

        const me = guild.members.me || await guild.members.fetchMe().catch(() => null);
        if (!me) {
            return safeRespond(interaction, asEmbedPayload({
                guildId: guild.id, type: "error",
                title: "❌ Couldn't fetch bot member",
                description: "I can't fetch my own member object in this guild.",
                ephemeral: true,
            }));
        }
        const required = [P.ManageChannels, P.ManageRoles, P.ManageGuild];
        const missing = required.filter((p) => !me.permissions.has(p));
        if (missing.length) {
            return safeRespond(interaction, asEmbedPayload({
                guildId: guild.id, type: "error",
                title: "❌ Bot Missing Permissions",
                description:
                    "I need the following permissions to run setup:\n" +
                    "• **Manage Channels**\n• **Manage Roles**\n• **Manage Server**\n\n" +
                    "Please re-invite me or grant them and try again.",
                ephemeral: true,
            }));
        }

        const presetKey = interaction.options.getString("preset");
        const dryRun = interaction.options.getBoolean("dry_run") ?? false;
        const skipExisting = interaction.options.getBoolean("skip_existing") ?? true;
        const preset = PRESETS[presetKey];
        if (!preset) {
            return safeRespond(interaction, asEmbedPayload({
                guildId: guild.id, type: "error",
                title: "❌ Unknown preset",
                description: `No preset named \`${presetKey}\`.`,
                ephemeral: true,
            }));
        }

        // Long-running op — defer ASAP.
        try {
            await interaction.deferReply({ ephemeral: false });
        } catch { /* already replied somehow */ }

        // ------------------------------------------------------------
        //  Execute setup
        // ------------------------------------------------------------
        const log = new SetupLog();
        const createdRoles = new Map();   // name -> Role
        const createdChannels = new Map();// name -> Channel

        try {
            // 1. ROLES
            for (const group of preset.roleGroups) {
                for (const bp of ROLE_BLUEPRINTS[group] || []) {
                    await provisionRole({ guild, bp, dryRun, skipExisting, log, createdRoles });
                }
            }

            // 2. CATEGORIES + CHANNELS
            const staffRoles = [...createdRoles.values()].filter((r) =>
                ["👑 Owner", "🛡️ Admin", "⚔️ Moderator", "🧰 Helper"].includes(r.name)
            );

            for (const catKey of preset.categories) {
                const cat = CATEGORY_BLUEPRINTS[catKey];
                if (!cat) continue;
                await provisionCategory({
                    guild, cat, dryRun, skipExisting, log, staffRoles, createdChannels, createdRoles,
                });
            }

            // 3. MUTED ROLE OVERWRITES — deny SendMessages/AddReactions in all text/voice channels
            const mutedRole = createdRoles.get("🔇 Muted") || guild.roles.cache.find((r) => r.name === "🔇 Muted");
            if (mutedRole && !dryRun) {
                for (const ch of guild.channels.cache.values()) {
                    if (ch.type === ChannelType.GuildText || ch.type === ChannelType.GuildVoice || ch.type === ChannelType.GuildAnnouncement) {
                        try {
                            await ch.permissionOverwrites.edit(mutedRole, {
                                SendMessages: false,
                                AddReactions: false,
                                Speak: false,
                                SendMessagesInThreads: false,
                                CreatePublicThreads: false,
                                CreatePrivateThreads: false,
                            });
                        } catch { /* ignore per-channel failures */ }
                    }
                }
                log.add("🔇", `Applied Muted-role overwrites to ${guild.channels.cache.size} channels.`);
            }

            // 4. WIRE BOT SETTINGS (case channel, ticket panel channel, etc.)
            if (!dryRun) {
                const settings = getGuildSettings(guild.id);
                const casesCh = findCreatedByName(createdChannels, "cases");
                const supportCh = findCreatedByName(createdChannels, "support");
                if (casesCh) {
                    settings.caseChannelId = casesCh.id;
                    log.add("🧾", `Case feed set to <#${casesCh.id}>.`);
                }
                if (supportCh) {
                    settings.ticketPanelChannelId = supportCh.id;
                    log.add("🎫", `Ticket panel channel set to <#${supportCh.id}>.`);
                }
                await saveSettings().catch((e) => console.error("[server_setup] saveSettings:", e));
            }

            // 5. POST WELCOME + RULES EMBEDS
            if (!dryRun) {
                const welcomeCh = findCreatedByName(createdChannels, "welcome");
                const rulesCh   = findCreatedByName(createdChannels, "rules");
                const supportCh2 = findCreatedByName(createdChannels, "support");
                const generalCh = findCreatedByName(createdChannels, "general");
                if (welcomeCh) await postWelcomeEmbed(welcomeCh, guild, { rulesCh, supportCh: supportCh2, generalCh }).catch(() => {});
                if (rulesCh)   await postRulesEmbed(rulesCh, guild).catch(() => {});
                if (welcomeCh) log.add("👋", `Posted welcome message in <#${welcomeCh.id}>.`);
                if (rulesCh)   log.add("📜", `Posted rules message in <#${rulesCh.id}>.`);
            }
        } catch (err) {
            console.error("[server_setup] Fatal error:", err);
            log.add("❌", `Fatal error: \`${err?.message || err}\``);
        }

        // ------------------------------------------------------------
        //  Build summary embed
        // ------------------------------------------------------------
        const title = dryRun
            ? `🧪 Dry Run — ${preset.label}`
            : `✅ Setup Complete — ${preset.label}`;
        const description = dryRun
            ? "No changes were made. Here's what **would** happen:"
            : `Your server has been provisioned with the **${preset.label}** preset.`;

        const summary = buildCoolEmbed({
            guildId: guild.id,
            type: dryRun ? "info" : "success",
            title,
            description: `${description}\n\n> ${preset.description}`,
            fields: log.toFields(),
            showAuthor: true,
            client: interaction.client,
        });

        summary.setFooter({
            text: dryRun
                ? "Re-run without dry_run to apply."
                : `Tip: run ,ticket in #support to deploy the ticket panel.`,
        });

        return safeRespond(interaction, { embeds: [summary] });
    },
};

// ========================================================================
//  HELPERS
// ========================================================================

class SetupLog {
    constructor() { this.entries = []; }
    add(icon, line) { this.entries.push(`${icon} ${line}`); }
    toFields() {
        // Discord embed field values cap at 1024 chars — chunk if needed.
        const chunks = [];
        let cur = "";
        for (const line of this.entries) {
            if ((cur + "\n" + line).length > 1000) {
                chunks.push(cur);
                cur = line;
            } else {
                cur = cur ? `${cur}\n${line}` : line;
            }
        }
        if (cur) chunks.push(cur);
        if (!chunks.length) return [{ name: "Actions", value: "*(nothing to do)*" }];
        return chunks.map((c, i) => ({
            name: i === 0 ? "📋 Actions" : `📋 Actions (cont.)`,
            value: c,
        }));
    }
}

function findCreatedByName(map, name) {
    for (const [k, v] of map.entries()) {
        if (k === name || k.toLowerCase() === name.toLowerCase()) return v;
    }
    return null;
}

async function provisionRole({ guild, bp, dryRun, skipExisting, log, createdRoles }) {
    const existing = guild.roles.cache.find((r) => r.name === bp.name);
    if (existing && skipExisting) {
        createdRoles.set(bp.name, existing);
        log.add("⏭️", `Role **${bp.name}** already exists — skipped.`);
        return;
    }
    if (dryRun) {
        log.add("🧪", `Would create role **${bp.name}**.`);
        return;
    }
    try {
        const role = await guild.roles.create({
            name: bp.name,
            color: bp.color,
            hoist: !!bp.hoist,
            mentionable: !!bp.mentionable,
            permissions: new PermissionsBitField(bp.perms || []),
            reason: "server_setup command",
        });
        createdRoles.set(bp.name, role);
        log.add("🎭", `Created role **${bp.name}**.`);
    } catch (e) {
        log.add("⚠️", `Failed to create role **${bp.name}**: \`${e.message}\``);
    }
}

async function provisionCategory({
    guild, cat, dryRun, skipExisting, log, staffRoles, createdChannels, createdRoles,
}) {
    // Build permission overwrites for the category if staff-only
    const staffOverwrites = cat.staffOnly
        ? [
              { id: guild.roles.everyone.id, deny: [P.ViewChannel] },
              ...staffRoles.map((r) => ({ id: r.id, allow: [P.ViewChannel, P.SendMessages, P.ReadMessageHistory] })),
          ]
        : [];

    // 1) Create or fetch the category
    let category = guild.channels.cache.find(
        (c) => c.type === ChannelType.GuildCategory && c.name === cat.name
    );

    if (!category) {
        if (dryRun) {
            log.add("🧪", `Would create category **${cat.name}**.`);
        } else {
            try {
                category = await guild.channels.create({
                    name: cat.name,
                    type: ChannelType.GuildCategory,
                    permissionOverwrites: staffOverwrites,
                    reason: "server_setup command",
                });
                log.add("📁", `Created category **${cat.name}**.`);
            } catch (e) {
                log.add("⚠️", `Failed to create category **${cat.name}**: \`${e.message}\``);
                return;
            }
        }
    } else {
        log.add("⏭️", `Category **${cat.name}** already exists — reusing.`);
    }

    // 2) Create child channels
    for (const ch of cat.channels) {
        const existing = guild.channels.cache.find(
            (c) => c.name === ch.name && c.parentId === (category?.id ?? null)
        );
        if (existing && skipExisting) {
            createdChannels.set(ch.name, existing);
            log.add("⏭️", `Channel **#${ch.name}** already exists — skipped.`);
            continue;
        }
        if (dryRun) {
            log.add("🧪", `Would create **#${ch.name}** (${ch.type}) in **${cat.name}**.`);
            continue;
        }

        // Permission overwrites for this channel
        const overwrites = [];
        if (ch.staffOnly || cat.staffOnly) {
            overwrites.push({ id: guild.roles.everyone.id, deny: [P.ViewChannel] });
            for (const r of staffRoles) {
                overwrites.push({ id: r.id, allow: [P.ViewChannel, P.SendMessages, P.ReadMessageHistory] });
            }
        }
        if (ch.readOnly) {
            overwrites.push({
                id: guild.roles.everyone.id,
                allow: [P.ViewChannel, P.ReadMessageHistory],
                deny: [P.SendMessages, P.AddReactions, P.CreatePublicThreads, P.CreatePrivateThreads],
            });
            for (const r of staffRoles) {
                overwrites.push({ id: r.id, allow: [P.ViewChannel, P.SendMessages, P.ReadMessageHistory, P.AddReactions] });
            }
        }

        try {
            const type = ch.type === "voice" ? ChannelType.GuildVoice : ChannelType.GuildText;
            const channel = await guild.channels.create({
                name: ch.name,
                type,
                parent: category?.id,
                topic: ch.topic || undefined,
                permissionOverwrites: overwrites.length ? overwrites : undefined,
                reason: "server_setup command",
            });
            createdChannels.set(ch.name, channel);
            log.add(ch.type === "voice" ? "🔊" : "💬", `Created **${ch.type === "voice" ? channel.name : "#" + channel.name}**.`);
        } catch (e) {
            log.add("⚠️", `Failed to create **${ch.name}**: \`${e.message}\``);
        }
    }
}

async function postWelcomeEmbed(channel, guild, { rulesCh, supportCh, generalCh } = {}) {
    const rulesMention   = rulesCh   ? `<#${rulesCh.id}>`   : "**#rules**";
    const generalMention = generalCh ? `<#${generalCh.id}>` : "**#general**";
    const supportMention = supportCh ? `<#${supportCh.id}>` : "**#support**";

    const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle(`👋 Welcome to ${guild.name}!`)
        .setDescription(
            `We're glad to have you here!\n\n` +
            `📜 Read the rules in ${rulesMention}\n` +
            `💬 Jump into ${generalMention} and say hi\n` +
            `🎫 Need help? Open a ticket in ${supportMention}\n\n` +
            `_Enjoy your stay!_`
        )
        .setThumbnail(guild.iconURL({ size: 256 }) || null)
        .setTimestamp();
    await channel.send({ embeds: [embed] });
}

async function postRulesEmbed(channel, guild) {
    const embed = new EmbedBuilder()
        .setColor(0xED4245)
        .setTitle(`📜 ${guild.name} — Server Rules`)
        .setDescription(
            "By being in this server, you agree to follow these rules:"
        )
        .addFields(
            { name: "1️⃣  Be respectful",       value: "No harassment, hate speech, discrimination, or personal attacks." },
            { name: "2️⃣  No spam",              value: "Don't flood chat, post in the wrong channel, or mass-ping." },
            { name: "3️⃣  Keep it SFW",          value: "No NSFW, gore, or suggestive content — anywhere." },
            { name: "4️⃣  No advertising",       value: "No self-promo, invite links, or DM advertising without staff approval." },
            { name: "5️⃣  Follow Discord ToS",   value: "Obey Discord's [Terms of Service](https://discord.com/terms) and [Community Guidelines](https://discord.com/guidelines)." },
            { name: "6️⃣  Staff has final say",  value: "Moderators can enforce rules and make judgment calls as needed." },
        )
        .setFooter({ text: "Breaking these rules may result in warnings, mutes, kicks, or bans." })
        .setTimestamp();
    await channel.send({ embeds: [embed] });
}
