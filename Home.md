# 📖 My Discord Bot — Wiki

Welcome to the official wiki for **My Discord Bot**, a powerful multi-purpose Discord bot built with [discord.js v14](https://discord.js.org/) and [Node.js](https://nodejs.org/).

---

## 📑 Table of Contents

- [Overview](#overview)
- [Features at a Glance](#features-at-a-glance)
- [Requirements](#requirements)
- [Setup & Configuration](#setup--configuration)
- [Slash Commands](#slash-commands)
  - [General](#general-slash-commands)
  - [Fun](#fun-slash-commands)
- [Prefix Commands](#prefix-commands)
  - [Configuration](#configuration-prefix-commands)
  - [Features](#features-prefix-commands)
  - [Moderation](#moderation-prefix-commands)
- [Background Systems](#background-systems)
- [Permissions Reference](#permissions-reference)

---

## Overview

My Discord Bot is a feature-rich, self-hosted Discord bot that combines moderation tools, utility commands, AI-powered features, and fun interactions — all in one package.

| Property | Value |
|---|---|
| **Prefix** | `,` (comma) |
| **Slash Commands** | ✅ Yes (auto-deployed globally) |
| **Database** | SQLite (activity, reminders, todos, reputation) + JSON (settings, AFK, booster roles) |
| **AI Provider** | Google Gemini AI |

---

## Features at a Glance

| Feature | Description |
|---|---|
| 💤 **AFK System** | Set AFK status; bot alerts others when you're pinged |
| 🤖 **Autoresponders** | Per-server trigger→response rules with optional content filter |
| 🎫 **Ticket System** | Fully customizable button-based ticket panels with rate limiting |
| 🧾 **Case / Mod Log** | Unified feed for moderation actions and ticket events |
| 💎 **Booster Roles** | Server boosters can create and colour their own custom role |
| ⚠️ **Warning System** | Issue warnings, view history, and configure automatic punishment thresholds |
| 🧠 **AI Integration** | Ask questions, translate text, summarise conversations via Gemini AI |
| 🎨 **Image Generation** | Generate images from a text prompt via Pollinations.ai |
| ⏰ **Reminders** | Set personal time-based reminders delivered via DM or channel |
| ✅ **To-Do Lists** | Personal per-user to-do list stored in SQLite |
| 📈 **Activity Forecasting** | Predict high-activity windows with linear regression on 7-day data |
| 🧬 **Personality Evolution** | Bot's AI personality (sarcasm, verbosity, emoji density) evolves from reaction feedback |

---

## Requirements

- **Node.js** v18 or later
- A **Discord Bot Token** ([create one here](https://discord.com/developers/applications))
- A **Google Gemini API Key** (for AI features — [get one here](https://aistudio.google.com/))
- The following **Discord Privileged Intents** enabled in the Developer Portal:
  - `Server Members Intent`
  - `Message Content Intent`

---

## Setup & Configuration

1. **Clone the repository**

   ```bash
   git clone https://github.com/KozzyXofficial/my-discord-bot.git
   cd my-discord-bot
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Create a `.env` file** in the project root with the following variables:

   ```env
   TOKEN=your_discord_bot_token
   GEMINI_API_KEY=your_google_gemini_api_key
   ```

4. **Start the bot**

   ```bash
   # Production
   npm start

   # Development (auto-restarts on file changes)
   npm run dev
   ```

   On first launch, the bot will:
   - Initialize the SQLite database
   - Load all slash and prefix commands
   - Automatically deploy slash commands globally to Discord

5. **Set up server-specific features** (optional, run inside your Discord server):

   | Command | What it does |
   |---|---|
   | `,case_channel #channel` | Set the channel that receives moderation & ticket logs |
   | `,ticket_channel #channel` | Set where the ticket panel is posted |
   | `,ticket` | Post the ticket creation panel |

---

## Slash Commands

> Slash commands are triggered by typing `/` in Discord. They are deployed automatically when the bot starts.

### General Slash Commands

| Command | Description |
|---|---|
| `/help` | Paginated overview of all available commands |
| `/modhelp` | Moderator-specific command reference (4 pages) |
| `/features` | Interactive list of all bot background systems |
| `/afk` | Set your AFK status (slash version) |
| `/userinfo [user]` | View account creation date, server join date, and roles |
| `/serverinfo` | Show server stats: member count, channels, roles, and owner |
| `/avatar [user]` | Display a user's avatar (defaults to your own) |
| `/banner [user]` | Display a user's Discord profile banner |
| `/remind <time> <what>` | Set a personal reminder (e.g. `10m`, `2h`, `1d`) — 30s cooldown |
| `/ask <prompt>` | Ask Gemini AI a question — 30s cooldown |
| `/translate <text> <to>` | Translate text to any language — 30s cooldown |
| `/define <word>` | Look up a word definition via the Dictionary API |
| `/decide <options>` | Pick randomly from a comma-separated list of options |
| `/summarize [limit]` | Summarise the last 20–50 messages in the channel using AI — 60s cooldown |
| `/todo <add\|list\|remove\|clear>` | Manage your personal to-do list |

### Fun Slash Commands

| Command | Description |
|---|---|
| `/hug <user>` | Send a hug with a random GIF |
| `/roast <user>` | Send a light-hearted roast message |
| `/topic` | Get a random conversation starter |
| `/imagine <prompt>` | Generate an image from a text prompt (Pollinations.ai) |

---

## Prefix Commands

> The default prefix is **`,`** (comma). Example: `,kick @User Spamming`.

### Configuration Prefix Commands

> Most configuration commands require **Manage Guild** or **Manage Messages** permissions.

| Command | Description | Permission |
|---|---|---|
| `,autoresponder add <trigger> <response>` | Add a guild autoresponder | Manage Messages |
| `,autoresponder remove <trigger>` | Remove a guild autoresponder | Manage Messages |
| `,autoresponder list` | List all autoresponders for the server | Manage Messages |
| `,autoresponder_filter_on` | Enable content filtering for autoresponders | Manage Guild |
| `,autoresponder_filter_off` | Disable content filtering for autoresponders | Manage Guild |
| `,case_channel <#channel>` | Set the channel for moderation & ticket logs | Manage Guild |
| `,ticket_channel <#channel>` | Set the channel where the ticket panel is posted | Manage Guild |
| `,ticket` | Post the ticket creation panel in the configured channel | — |
| `,ticket_edit <title\|text\|add\|remove\|list>` | Customise the ticket panel title, text, or category list | Manage Guild |
| `,ticket_close <time\|off>` | Set an auto-close timer for inactive tickets (e.g. `30m`) | Manage Guild |
| `,ticket_ping <@role>` | Set a role to display in ticket channels (does not ping) | Manage Guild |

### Features Prefix Commands

| Command | Description | Notes |
|---|---|---|
| `,afk [reason]` | Set your AFK status with an optional reason | Auto-removed on next message |
| `,boosterrole create <name>` | Create a custom role (server boosters only) | Requires active boost |
| `,boosterrole color <hex>` | Change the colour of your booster role | e.g. `,boosterrole color #FF5733` |
| `,hot-time` | Forecast the next high-activity window using 7-day message data | Uses linear regression |
| `,summary` | Summarise the last 100 messages in the channel using Gemini AI | — |

### Moderation Prefix Commands

| Command | Description | Permission |
|---|---|---|
| `,kick <@user> [reason]` | Kick a member from the server | Kick Members |
| `,ban <@user> [reason]` | Permanently ban a member | Ban Members |
| `,damage <@user> <duration>` | Timeout (mute) a member for a set duration (e.g. `10m`, `1h`) | Moderate Members |
| `,heal <@user>` | Remove an active timeout from a member | Moderate Members |
| `,warn <@user> [reason]` | Issue a warning to a member | Moderate Members |
| `,warn remove <@user> [count]` | Remove one or more warnings from a member | Moderate Members |
| `,warnings [@user]` | Check warning count (your own or another user's) | — |
| `,clearwarns <@user>` | Clear all warnings for a member | Moderate Members |
| `,warnthreshold add <count> <action>` | Set an automatic action when warnings reach a threshold | Moderate Members |
| `,warnthreshold remove <count>` | Remove a warning threshold | Moderate Members |
| `,warnthreshold list` | List all configured warning thresholds | Moderate Members |
| `,clear <amount>` | Bulk delete 1–100 messages from the current channel | Manage Messages |
| `,lock [#channel] [reason]` | Lock a channel so members can't send messages | Manage Channels |
| `,unlock [#channel]` | Unlock a previously locked channel | Manage Channels |
| `,slowmode [#channel] <seconds\|off>` | Set or remove slowmode on a channel | Manage Channels |
| `,nick <@user> <nickname>` | Change a member's nickname | Manage Nicknames |
| `,nicklock <@user>` | Lock a member's nickname so they cannot change it | Manage Nicknames |
| `,nickunlock <@user>` | Unlock a member's previously locked nickname | Manage Nicknames |

---

## Background Systems

These systems run automatically without any command input.

| System | Trigger | Behaviour |
|---|---|---|
| **Spam Detection** | `messageCreate` | Automatically detects and flags repeated/rapid message spam |
| **AFK Alerts** | `messageCreate` | Notifies the sender when they ping a member who is AFK |
| **Autoresponders** | `messageCreate` | Replies with configured responses when trigger words are detected |
| **Activity Logging** | `messageCreate` | Records per-channel message activity to SQLite for forecasting |
| **Reputation Tracking** | `messageCreate` | Tracks user activity for internal reputation scoring |
| **Nickname Lock** | `guildMemberUpdate` | Reverts nickname changes for members with an active nick lock |
| **Booster Title** | `guildMemberAdd` | Restores booster role automatically when a booster rejoins |
| **Auto Command Deploy** | `guildCreate` | Deploys slash commands to a new server immediately on join |
| **Personality Evolution** | `messageReactionAdd/Remove` | Adjusts the AI's sarcasm, verbosity, and emoji density based on reaction feedback |
| **Reminder Scheduler** | Background (SQLite) | Delivers reminders at the scheduled time via DM or channel message |

---

## Permissions Reference

The bot requires the following permissions in your server to function fully:

| Permission | Required for |
|---|---|
| Send Messages | All commands and responses |
| Embed Links | Rich embed responses |
| Read Message History | `/summarize`, `,summary`, `,clear` |
| Manage Messages | `,clear`, autoresponders |
| Manage Channels | `,lock`, `,unlock`, `,slowmode` |
| Manage Roles | Booster role system |
| Manage Nicknames | `,nick`, `,nicklock`, `,nickunlock` |
| Kick Members | `,kick` |
| Ban Members | `,ban` |
| Moderate Members | `,damage`, `,heal`, `,warn` and related |
| Add Reactions | Personality evolution system |

---

*Built with ❤️ using [discord.js](https://discord.js.org/) v14*
