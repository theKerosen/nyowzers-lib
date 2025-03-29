# Nyowzers Lib ᓚᘏᗢ

[![Node.js Version](https://img.shields.io/badge/node-%3E%3D16.9.0-blue.svg)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT) <!-- Choose your license -->

A custom, work-in-progress Discord API library built with Node.js, created as a learning exercise and for specific project needs.

**⚠️ Status: Experimental / Under Development ⚠️**

This library was built primarily as a learning project and to refactor a specific bot application. It is **not production-ready** and likely contains bugs, missing features, and simplified implementations (especially around rate limiting, caching, and error handling). Use with caution!

## About This Project

Nyowzers Lib started as a refactor of a custom-built Discord library initially tailored for a specific bot integrating with a Lua-based "Tickrate" system. The original goal was to create a more modular, maintainable, and understandable structure inspired by popular libraries like discord.js, separating the core Discord API interactions from application-specific logic.

This library now provides a foundational layer for interacting with the Discord Gateway (v10) and REST API, handling events, basic structures, and command registration, while allowing the main bot application to manage features like the Tickrate integration.

## Features (Current)

*   **Discord API v10:** Targets the current API version.
*   **Gateway Client:** Connects to the Discord Gateway, handles heartbeating, identifies/resumes sessions, and processes incoming events using `WebSocketManager` and `GatewayEventHandler`. Supports `zlib-stream` compression.
*   **REST Client:** Handles HTTPS requests to the Discord REST API (`RESTManager`) with basic rate limit awareness (needs improvement).
*   **Event Emitter:** Client emits standard Discord events (e.g., `Events.READY`, `Events.MESSAGE_CREATE`, `Events.INTERACTION_CREATE`).
*   **Core Structures:** Provides classes for common Discord objects:
    *   `Guild`, `Channel`, `TextChannel`, `VoiceChannel`, `CategoryChannel`, `StageChannel`, `DMChannel`
    *   `Message`, `User`, `Member`
    *   `Interaction`, `CommandInteraction`, `ButtonInteraction`
*   **Managers:** Basic managers for caching and retrieving structures:
    *   `GuildManager`, `ChannelManager`, `UserManager`, `MemberManager`, `MessageManager`
*   **Builders:** Utilities for creating complex objects:
    *   `EmbedBuilder`, `ActionRowBuilder`, `ButtonBuilder`, `SlashCommandBuilder`
*   **Collectors:** Basic event collectors:
    *   `MessageCollector`, `InteractionCollector`
*   **Application Command Management:**
    *   `ApplicationCommandManager` to fetch, create, edit, delete, and bulk overwrite global and guild slash commands.
    *   Includes relevant `RESTManager` methods.

## Installation

Currently, this library isn't published on npm. To use it in your project:

1.  **Clone/Download:** Get the `nyowzers-lib` code.
2.  **Install Locally:** Navigate to your bot project's directory in your terminal and install the library using its local path:

    ```bash
    npm install /path/to/your/nyowzers-lib ws node-fetch@2 zlib-sync abort-controller
    ```

    *   Replace `/path/to/your/nyowzers-lib` with the correct relative or absolute path.
    *   `ws`, `node-fetch@2`, `zlib-sync`, and `abort-controller` are required dependencies.

3.  **Prerequisites:** Node.js v16.9.0 or higher is recommended.

## Basic Usage

Here's a minimal example of how to log in and respond to a simple command:

```javascript
// index.js (Your bot's entry point)
require('dotenv').config(); // For loading DISCORD_TOKEN

// Use your library's package name if different
const { Client, Events, Intents } = require('nyowzers-lib');

// 1. Create a Client instance with necessary intents
const client = new Client({
    token: process.env.DISCORD_TOKEN,
    intents: [
        Intents.Flags.GUILDS,
        Intents.Flags.GUILD_MESSAGES,
        Intents.Flags.MESSAGE_CONTENT, // Requires verification + gateway toggle!
    ]
});

// 2. Listen for the Ready event
client.once(Events.READY, () => {
    console.log(`Nyowzers Lib is ready! Logged in as ${client.user.tag}`);
});

// 3. Listen for Messages
client.on(Events.MESSAGE_CREATE, async (message) => {
    // Ignore bots and non-commands
    if (message.author.bot || !message.content.startsWith('!')) return;

    const args = message.content.slice(1).trim().split(/ +/);
    const commandName = args.shift().toLowerCase();

    if (commandName === 'ping') {
        try {
            const replyMsg = await message.reply('Pong!');
            console.log(`Replied with message ID: ${replyMsg.id}`);
        } catch (error) {
            console.error("Failed to reply to ping:", error);
        }
    }
});

// 4. Log in
console.log("Logging in...");
client.login(); // Token is provided in the constructor options
```

## Example: Integrating External Logic (like Tickrate System)

Nyowzers Lib is designed to handle Discord interactions, allowing your main application to manage other logic.

```javascript
// bot.js (Your main application class/file)
require('dotenv').config();
const { Client, Events, Intents, Collection, EmbedBuilder } = require('nyowzers-lib');
const LuaHandler = require('./components/interpreters/LuaHandler'); // Your custom component
const TickrateClient = require('./components/clients/TickrateClient'); // Your custom component
const handleCommand = require('./handlers/commandHandler'); // Your command handler
const { updateAndCheckStatus, initializeStatusState } = require('./features/csStatus'); // Your feature logic

class Bot {
    constructor() {
        this.client = new Client({ token: process.env.DISCORD_TOKEN, intents: [/*...*/] });
        this.luaHandler = new LuaHandler(/*...*/);
        this.tickrateClient = new TickrateClient(/*...*/);
        this.client.commands = new Collection();
        this.client.cooldowns = new Collection();
        this.client.statusDataMap = new Map();
        this.statusState = initializeStatusState();
    }

    loadCommands() { /* ... reads ./commands/ folder ... */ }

    registerEventHandlers() {
        this.client.once(Events.READY, async () => {
            console.log(`Ready! Logged in as ${this.client.user.tag}`);
            this.luaHandler.loadLuaFiles();
            // Start background tasks using tickrateClient
            await updateAndCheckStatus(this.client, this.tickrateClient, this.luaHandler, this.statusState);
            setInterval(/* ... call updateAndCheckStatus ... */);
        });

        this.client.on(Events.MESSAGE_CREATE, async (message) => {
            // The command handler uses client.commands
            await handleCommand(this.client, message);
        });
         // ... other handlers ...
    }

    start() {
        this.loadCommands();
        this.registerEventHandlers();
        this.client.login();
    }
}

// index.js
// const Bot = require('./src/Bot');
// const botInstance = new Bot();
// botInstance.start();
```

In this structure:
*   `Bot.js` manages the `Client`, `TickrateClient`, and `LuaHandler`.
*   Background tasks (`updateAndCheckStatus`) use `TickrateClient` and store results on `client.statusDataMap`.
*   Commands (like `status` located in `./commands/`) are loaded into `client.commands` and executed by `handleCommand`.
*   Commands access the shared data (`client.statusDataMap`) and use Nyowzers Lib builders (`EmbedBuilder`) to format replies.

## Project Structure (Library `nyowzers-lib/`)

```
nyowzers-lib/
├── src/
│   ├── index.js             # Main library export
│   ├── Client.js            # The main Client class
│   ├── rest/                # Handles REST API calls
│   ├── gateway/             # Handles WebSocket Gateway connection & events
│   ├── structures/          # Classes for Discord objects (Message, Guild, etc.)
│   ├── managers/            # Classes for managing collections of structures
│   ├── util/                # Constants, Collections, BitFields, Helpers
│   ├── builders/            # EmbedBuilder, ActionRowBuilder, ButtonBuilder, etc.
│   └── collectors/          # MessageCollector, InteractionCollector
│
├── package.json
└── README.md
```

## To-Do / Future Improvements

*   [ ] **Robust Rate Limiting:** Implement a proper request queue and bucket handling in `RESTManager`.
*   [ ] **Sharding:** Add support for running the bot across multiple Gateway shards.
*   [ ] **Voice Support:** Implement voice connections (sending/receiving audio).
*   [ ] **More Structures/Managers:** Add Roles, Emojis, Stickers, Threads, Stage Instances, etc.
*   [ ] **More Builders:** Select Menus, Modals, Text Inputs.
*   [ ] **More Interaction Types:** Context Menus, Modal Submits, Autocomplete handling in commands.
*   [ ] **Caching Strategies:** Implement more advanced caching options (e.g., sweeping).
*   [ ] **Permissions:** Add structures and helpers for calculating/checking permissions.
*   [ ] **Typings:** Add TypeScript definition files (`.d.ts`).
*   [ ] **Testing:** Implement unit and integration tests.
*   [ ] **Error Handling:** More specific error classes and handling.

## Dependencies

*   [ws](https://github.com/websockets/ws): WebSocket client implementation.
*   [node-fetch@2](https://github.com/node-fetch/node-fetch/tree/2.x): For making HTTPS requests to the Discord API (v2 for CommonJS compatibility).
*   [zlib-sync](https://github.com/nodeca/zlib-sync): For Gateway compression.
*   [abort-controller](https://github.com/mysticatea/abort-controller): Polyfill for request timeouts.

## Contributing

This is primarily a personal learning project. Contributions are not actively sought, but feel free to fork the repository or open issues for bugs you find.

**Before Committing:**

1.  **Replace Placeholders:** Change `nyowzers-lib` in the examples to the actual name defined in your library's `package.json` if it's different.
2.  **Choose a License:** The example uses MIT. If you prefer a different open-source license (or none), update the badge and the link/text at the bottom. Create a `LICENSE` file in the root of `nyowzers-lib` containing the full text of your chosen license.
3.  **Review:** Read through it one more time to ensure it accurately reflects the library's current state and purpose.
