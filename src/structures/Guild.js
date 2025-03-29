const Base = require("./Base");
const MemberManager = require("../managers/MemberManager");

class Guild extends Base {
    constructor(client, data) {
        super(client);

        this.id = data.id;

        this._memberManagerInstance = null;

        this.partial = data.partial ?? !data.name;
        this.unavailable = data.unavailable ?? false;

        if (!this.unavailable) {
            this._patch(data);
        }
    }

    _patch(data) {
        const patchableProperties = [
            "name",
            "icon",
            "splash",
            "discovery_splash",
            "owner_id",
            "afk_channel_id",
            "afk_timeout",
            "verification_level",
            "default_message_notifications",
            "explicit_content_filter",
            "features",
            "mfa_level",
            "application_id",
            "system_channel_id",
            "system_channel_flags",
            "rules_channel_id",
            "max_members",
            "vanity_url_code",
            "description",
            "banner",
            "premium_tier",
            "premium_subscription_count",
            "preferred_locale",
            "public_updates_channel_id",
            "max_video_channel_users",
            "approximate_member_count",
            "approximate_presence_count",
            "welcome_screen",
            "nsfw_level",
            "stickers",
            "premium_progress_bar_enabled",
            "latest_onboarding_question_id",
        ];

        for (const key of patchableProperties) {
            if (data.hasOwnProperty(key)) {
                if (key === "premium_subscription_count") {
                    this[key] = data[key] ?? 0;
                } else {
                    this[key] = data[key];
                }
            }
        }

        if (Array.isArray(data.channels)) {
            if (this.client?.channels) {
                for (const chanData of data.channels) {
                    this.client.channels._add(chanData, this, { cache: true });
                }
            }
        }

        if (Array.isArray(data.members)) {
            const membersManager = this.members;
            if (membersManager) {
                membersManager.cache.clear();
                for (const memData of data.members) {
                    membersManager._add(memData);
                }
            } else {
                console.warn(
                    `[Guild._patch] MemberManager not yet available for guild ${this.id} during patch.`,
                );
            }
        }

        this.partial = false;
        this.unavailable = false;
        return this;
    }

    get members() {
        return this._memberManagerInstance ?? null;
    }

    get channels() {
        return (
            this.client?.channels?.cache.filter((c) => c.guildId === this.id) ??
            new Collection()
        );
    }

    async fetchOwner({ force = false } = {}) {
        if (!this.ownerId) return null;
        const membersManager = this.members;
        if (!membersManager) {
            console.warn(
                `[Guild.fetchOwner] MemberManager not available for guild ${this.id}`,
            );

            return null;
        }
        return membersManager.fetch(this.ownerId, { force });
    }

    async fetchOwner({ force = false } = {}) {
        if (!this.ownerId) return null;
        return this.members.fetch(this.ownerId, { force });
    }

    iconURL({ dynamic = true, size = 1024, format = "webp" } = {}) {
        if (!this.icon) return null;
        let formatStr = format.toLowerCase();
        if (dynamic && this.icon.startsWith("a_")) {
            formatStr = "gif";
        }
        return `https://cdn.discordapp.com/icons/${this.id}/${this.icon}.${formatStr}?size=${size}`;
    }

    bannerURL({ size = 1024, format = "webp" } = {}) {
        if (!this.banner) return null;

        const formatStr = format.toLowerCase();
        return `https://cdn.discordapp.com/banners/${this.id}/${this.banner}.${formatStr}?size=${size}`;
    }

    async fetch(force = true) {
        if (!this.partial || force) {
            const data = await this.client.rest.getGuild(this.id);
            this._patch(data);
            this.partial = false;
            return this;
        }
        return this;
    }

    async leave() {
        if (this.ownerId === this.client.user.id) {
            throw new Error("Cannot leave guild you own.");
        }
        await this.client.rest.leaveGuild(this.id);
    }

    toString() {
        return this.name ?? this.id;
    }
}

module.exports = Guild;
