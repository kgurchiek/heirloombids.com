import fs from 'fs';
import util from 'node:util';
import { createClient } from '@supabase/supabase-js';
import { Client, Partials, Events, GatewayIntentBits } from 'discord.js';

const config = JSON.parse((await fs.promises.readFile('config.json')).toString());
const client = new Client({ partials: [Partials.Channel, Partials.GuildMember, Partials.Message], intents: [GatewayIntentBits.Guilds, GatewayIntentBits.DirectMessages, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildMessages] });
const supabase = createClient(config.supabase.url, config.supabase.key);

class Monster {
    constructor(name, timestamp, day, event, threads, rage, thread, message, windows, killer, todGrabber, zone) {
        this.group = config.roster.monsterGroups.find(a => a.includes(name));
        this.name = this.group == null ? name : this.group.join('/');
        if (config.roster.placeholderMonsters.includes(this.name)) {
            this.alliances = 2;
            this.placeholders = {};
        }
        this.timestamp = timestamp;
        this.day = day;
        this.event = event;
        this.rage = rage;
        this.signups = Array(this.alliances).fill().map(() => Array(this.parties).fill().map(() => Array(this.slots).fill()));
        this.leaders = Array(this.alliances).fill().map(() => Array(this.parties).fill());
        this.removedLeader = Array(this.alliances).fill().map(() => Array(this.parties).fill());
        
        this.thread = thread;
        this.message = message;
        this.windows = windows || 0;
        if (this.name == 'Tiamat' && windows == null) this.windows = 1;
        this.killer = killer;
        this.todGrabber = todGrabber;
        this.todGrabs = [];
        this.zone = zone;

        this.verifiedClears = [];

        this.data = monsterList.find(a => a.monster_name == this.name.split('/')[this.day < 4 ? 0 : 1]);
        if (this.data == null) console.log(`Error: could not find data for monster "${this.name}"`);
        else if (thread == null) this.thread = threads[this.data.channel_type].find(a => a.name == this.name);
    }
    active = true;
    alliances = config.roster.alliances;
    parties = config.roster.parties;
    slots = config.roster.slots;
    calculatePoints(playerId) {
        return calculateCampPoints(this.data.monster_name, this.data.signups.filter(a => a.player_id.id == playerId).reduce((a, b) => a + b.windows || 0, 0), this.windows);
    }
    getPointType(camp) {
        if (camp) {
            let rule = campRules.find(a => a.monster_name == this.data.monster_name);
            if (rule == null) console.log(`Error: couldn't fetch camp point rule for ${this.data.monster_name}`);
            else return rule.type;
        } else {
            let type = this.data.monster_type;
            if (type == 'PPP') return 'PPP'
            if (type == 'NQ' && this.day >= 4) type = 'HQ';
            let rule = pointRules.find(a => a.monster_type == this.data.monster_type && a.dkp_value != 0 || a.ppp_value != 0);
            if (rule == null) console.log(`Error: couldn't fetch bonus point rule for ${this.data.monster_type}`);
            else return rule.dkp_value ? 'DKP' : 'PPP';
        }
    }
    calculateBonusPoints(signup) {
        let type = this.data.monster_type;
        if (type == 'NQ' && this.day >= 4) type = 'HQ'; 
        return calculateBonusPoints(signup, type);
    }
    createEmbeds() {
        if (this.active) {
            let signups = this.signups.flat(2).filter((a, i, arr) => a != null && arr.slice(0, i).find(b => b != null && a.user.id == b.user.id) == null).length;
            let embed = new EmbedBuilder()
                .setTitle(`🐉 ${this.name}${this.day == null ? '' : ` (Day ${this.day})`}${this.name == 'Tiamat' ? ` (Window ${this.windows})` : ''}${this.rage ? ' (Rage)' : ''}${this.paused ? ' (Paused)' : ''}`)
                .setThumbnail(`https://mrqccdyyotqulqmagkhm.supabase.co/storage/v1/object/public/${config.supabase.buckets.images}/${this.data.monster_name.split('_')[0].replaceAll(' ', '')}.png`)
                .setDescription(`**${signups} member${signups == 1 ? '' : 's'} signed up**\n🕒 Starts at <t:${this.timestamp}:D> <t:${this.timestamp}:T> (<t:${this.timestamp}:R>)${this.lastCleared == null ? '' : `\nLast Cleared: <t:${Math.floor(this.lastCleared.getTime() / 1000)}:R>`}${this.todGrabber == null ? '' : `\n**TOD Grabber: ${this.todGrabber.username}**`}${this.todGrabs.length == 0 ? '' : '\n\n**TOD Grabbers**'}${this.todGrabs.map(a => `\n**${a.player_id.username}: ${a.todgrab}**`).join('')}`)
                .addFields(
                    ...Array(this.alliances).fill().map((a, i) => [
                        Array(this.parties).fill().map((b, j) => {
                            let field = {
                                name: `${j == 0 ? `🛡️ Alliance ${i + 1} - ` : ''}Party ${j + 1}`,
                                value: `(0/0)`,
                                inline: true
                            };
                            for (let k = 0; k < this.slots; k++) {
                                let template = templateList.find(a => a.monster_name == this.data.monster_name && a.alliance_number == i + 1 && a.party_number == j + 1 && a.party_slot_number == k + 1);
                                if (template == null) {
                                    console.log(`Error: Cannot find template for ${this.name}, Alliance ${i + 1}, Party ${j + 1}, Slot ${k + 1}`);
                                    template = { allowed_job_ids: [] };
                                }

                                let role;
                                let username = '-';
                                if (this.signups[i][j][k] != null) {
                                    let job = jobList.find(a => a.job_id == this.signups[i][j][k].job);
                                    if (job == null) console.log(`Error: can't find job id: ${this.signups[i][j][k].job}`);
                                    else {
                                        role = `\`${job.color}${job.job_abbreviation}\``;
                                        username = `${this.leaders[i][j]?.id == this.signups[i][j][k].user.id ? '👑 ' : ''}${this.signups[i][j][k].user.username}${this.signups[i][j][k].alt ? ' 👥' : ''}${this.signups[i][j][k].tag_only ? ' **TAG**' : ''}`;
                                    }
                                }
                                if (role == null) {
                                    if (template.role == null) {
                                        let jobs = template.allowed_job_ids.map(a => {
                                            let job = jobList.find(b => b.job_id == a);
                                            if (job == null) {
                                                console.log(`Error: can't find job id: ${a}`);
                                                return null;
                                            }
                                            return `${job.color}${job.job_abbreviation}`;
                                        }).filter(a => a != null);
                                        role = jobs.length == 0 ? '`-`' : jobs.join('/');
                                    } else role = template.role;
                                }

                                field.value += `\n\`${role}\` ${username}`;
                            }

                            return field;
                        })
                    ]).reduce((a, b) => a.concat(b.reduce((c, d) => c.concat(d), [])), [])
                )
            if (this.placeholders != null) {
                let longest = Object.entries(this.placeholders).reduce((a, b) => Math.max(a, `${b[0]}: ${b[1]}`.length), 0)
                embed.addFields(
                    {
                        name: 'Placeholders',
                        value: Object.keys(this.placeholders).length == 0 ? '​' : `\`\`\`\n${Object.entries(this.placeholders).sort((a, b) => a > b ? 1 : -1).map(a => `${a[0]}: ${a[1]}${' '.repeat(longest - `${a[0]}: ${a[1]}`.length)} | ${(Math.floor(a[1] / 4) * 0.2).toFixed(1)} PPP`).join('\n')}\n\`\`\``
                    }
                )
            };
            return [embed];
        } else {
            if (this.data.signups.length == 0) {
                return [
                    new EmbedBuilder()
                        .setTitle(`🐉 ${this.name} (Day ${this.day})${this.rage ? ' (Rage)' : ''}`)
                        .setThumbnail(`https://mrqccdyyotqulqmagkhm.supabase.co/storage/v1/object/public/${config.supabase.buckets.images}/${this.data.monster_name.split('_')[0].replaceAll(' ', '')}.png`)
                        .setDescription('No participants recorded.')
                ]
            } else {
                return [
                    this.data.signups.filter(a => a.active),
                    this.data.signups.filter(a => !a.active && this.data.signups.find(b => b.active && b.player_id.id == a.player_id.id) == null)
                ].filter(a => a.length > 0).map((a, i) => {
                    let embed = new EmbedBuilder()
                        .setThumbnail(`https://mrqccdyyotqulqmagkhm.supabase.co/storage/v1/object/public/${config.supabase.buckets.images}/${this.data.monster_name.split('_')[0].replaceAll(' ', '')}.png`)
                    if (i == 0) embed.setTitle(`🐉 ${this.name} (Day ${this.day})${this.rage ? ' (Rage)' : ''}`);
                    embed.setDescription(`${i == 0 ? '🕒 Closed\n\n**Current Window**\n' : '**Previous Windows**\n'}\`\`\`\n${
                        a.filter((b, i, arr) => arr.slice(0, i).find(c => c.player_id.id == b.player_id.id) == null).map(b => {
                            let userSignups = this.data.signups.filter(c => c != null && c.player_id.id == b.player_id.id); 
                            let totalWindows = this.name == 'Tiamat' ? userSignups.length : userSignups.reduce((a, b) => a + b?.windows || 0, 0);
                            return `${b.active && b.windows == null && b.tagged == null && b.killed == null ? '✖' : '✓'} ${b.player_id.username}${this.name != 'Tiamat' && userSignups.length > 1 ? ` (${userSignups.length} signups)` : ''}${this.placeholders == null ? ((totalWindows == null || this.data.max_windows == 1) ? '' : ` - ${totalWindows}${this.windows == null ? '' : `/${this.windows}`} window${this.windows == null ? (totalWindows == 1 ? '' : 's') : (this.windows == 1 ? '' : 's')}`) : ` - ${b.placeholders} PH`}${b.tagged ? ' - T' : ''}${b.killed ? ' - K' : ''}${b.rage ? ' - R' : ''} Camp: ${this.placeholders != null ? `${(Math.floor(b.placeholders / 4) * 0.2).toFixed(1)} PPP` : `${this.calculatePoints(b.player_id.id)} ${this.getPointType(true)}`} Bonus: ${this.calculateBonusPoints(b)} ${this.getPointType(false)}`;
                        }).join('\n\n')
                    }\n\`\`\``);
                    if (this.verified) embed.setFooter({ text: '✓ Verified' });

                    return embed;
                }).filter(a => a != null);
            }
        }
    }
    createButtons() {
        let unverifiedClears = new Array(Math.min(0, this.windows || 0)).fill().map((a, i) => i);
        if (this.verified) {
            return this.data.signups.length == 0 ? [] : [
                new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setLabel('📷 Upload Tag Screenshot')
                            .setStyle(ButtonStyle.Primary)
                            .setCustomId(`screenshot-monster-${this.event}`),
                    ),
                unverifiedClears.length == 0 ? null : new ActionRowBuilder()
                    .addComponents(
                        new StringSelectMenuBuilder()
                            .setCustomId(`membersscreenshot-window-${this.event}`)
                            .setPlaceholder('📷 Upload Tiamat Attendance')
                            .addOptions(
                                unverifiedClears.map(a => 
                                    new StringSelectMenuOptionBuilder()
                                        .setLabel(`Window ${a + 1}`)
                                        .setValue(`${a}`)
                                )
                            )
                    )
            ].filter(a => a != null);
        }
        if (this.paused) return [
            new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`pause-unpause-${this.name}`)
                        .setStyle(ButtonStyle.Success)
                        .setLabel('▶ Unpase'),
                    new ButtonBuilder()
                        .setCustomId(`populate-monster-${this.name}`)
                        .setLabel('💰 Populate')
                        .setStyle(ButtonStyle.Success)
                ),
            unverifiedClears.length == 0 ? null : new ActionRowBuilder()
                .addComponents(
                    new StringSelectMenuBuilder()
                        .setCustomId(`membersscreenshot-window-${this.event}`)
                        .setPlaceholder('📷 Upload Tiamat Attendance')
                        .addOptions(
                            unverifiedClears.map(a => 
                                new StringSelectMenuOptionBuilder()
                                    .setLabel(`Window ${a + 1}`)
                                    .setValue(`${a}`)
                            )
                        )
                )
        ].filter(a => a != null);
        if (this.active) {
            return [
                new ActionRowBuilder()
                    .addComponents(
                        ...[
                            new ButtonBuilder()
                                .setCustomId(`quickjoin-job-${this.name}`)
                                .setLabel('≫ Quick Join')
                                .setStyle(ButtonStyle.Primary),
                            new ButtonBuilder()
                                .setCustomId(`signup-select-${this.name}`)
                                .setLabel('📝 Sign Up')
                                .setStyle(ButtonStyle.Primary),
                            new ButtonBuilder()
                                .setCustomId(`editroster-monster-${this.name}`)
                                .setLabel('🛡️ Edit Roster')
                                .setStyle(ButtonStyle.Primary),
                            this.signups.find((a, i) => a.find((b, j) => this.leaders[i][j] == null)) == null ? null : new ButtonBuilder()
                                .setCustomId(`leader-monster-${this.name}`)
                                .setLabel('👑 Leader')
                                .setStyle(ButtonStyle.Secondary),
                            this.data.channel_type == 'PPP' ? null : new ButtonBuilder()
                                .setCustomId(`todgrab-select-${this.name}`)
                                .setLabel('Tod Grab')
                                .setStyle(ButtonStyle.Secondary)
                        ].filter(a => a != null)
                    ),
                new ActionRowBuilder()
                    .addComponents(
                        ...[
                            new ButtonBuilder()
                                .setCustomId(`editsignup-monster-${this.event}`)
                                .setLabel('✏️ Edit Signup')
                                .setStyle(ButtonStyle.Secondary),
                            new ButtonBuilder()
                                .setCustomId(`leave-monster-${this.name}`)
                                .setLabel('✖ Leave')
                                .setStyle(ButtonStyle.Danger),
                            this.name == 'Tiamat' ? new ButtonBuilder()
                                .setCustomId(`clear-monster-${this.name}`)
                                .setLabel('Clear to Next Window')
                                .setStyle(ButtonStyle.Secondary) : null,
                            this.name == 'Tiamat' ? new ButtonBuilder()
                                .setCustomId(`revert-monster-${this.name}`)
                                .setLabel('Revert to Last Window')
                                .setStyle(ButtonStyle.Secondary)
                                .setDisabled(this.windows == 1) : null,
                            this.name == 'Tiamat' ? new ButtonBuilder()
                                .setCustomId(`wipe-monster-${this.name}`)
                                .setLabel('Wipe Signups')
                                .setStyle(ButtonStyle.Secondary) : null
                        ].filter(a => a != null)
                    ),
                this.placeholders == null ? null : new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId(`placeholder-increment-${this.name}`)
                            .setLabel('+1 Placeholder')
                            .setStyle(ButtonStyle.Secondary),
                        new ButtonBuilder()
                            .setCustomId(`placeholder-enter-${this.name}`)
                            .setLabel('Enter Placeholders')
                            .setStyle(ButtonStyle.Secondary),
                        new ButtonBuilder()
                            .setCustomId(`placeholder-remove-${this.name}`)
                            .setLabel('Remove Placeholders')
                            .setStyle(ButtonStyle.Secondary)
                    ),
                new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId(`pause-pause-${this.name}`)
                            .setStyle(ButtonStyle.Danger)
                            .setLabel('⏸ Pause'),
                        new ButtonBuilder()
                            .setCustomId(`populate-monster-${this.name}`)
                            .setLabel('💰 Populate')
                            .setStyle(ButtonStyle.Success)
                    ),
                unverifiedClears.length == 0 ? null : new ActionRowBuilder()
                    .addComponents(
                        new StringSelectMenuBuilder()
                            .setCustomId(`membersscreenshot-window-${this.event}`)
                            .setPlaceholder('📷 Upload Tiamat Attendance')
                            .addOptions(
                                unverifiedClears.map(a => 
                                    new StringSelectMenuOptionBuilder()
                                        .setLabel(`Window ${a + 1}`)
                                        .setValue(`${a}`)
                                )
                            )
                    )
            ].filter(a => a != null);
        }
        if (this.data.signups.length > 0) {
            let signups = this.data.signups.filter((a, i) => a.active || this.data.signups.find((b, j) => b.player_id.id == a.player_id.id && (b.active || j > i)) == null);
            return [
                new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setLabel('Attendance')
                            .setStyle(ButtonStyle.Primary)
                            .setCustomId(`attendance-monster-${this.event}`),
                        new ButtonBuilder()
                            .setLabel('📷 Upload Tag Screenshot')
                            .setStyle(ButtonStyle.Primary)
                            .setCustomId(`screenshot-monster-${this.event}`),
                        new ButtonBuilder()
                                .setCustomId(`editsignup-monster-${this.event}`)
                                .setLabel('✏️ Edit Signup')
                                .setStyle(ButtonStyle.Secondary)
                    ),
                ...new Array(Math.ceil(signups.length / 25)).fill().map((a, i) =>
                    new ActionRowBuilder()
                        .addComponents(
                            new StringSelectMenuBuilder()
                                .setPlaceholder('🛡️ Edit User')
                                .setCustomId(`editsignup-signup-${i}-${this.event}`)
                                .addOptions(
                                    ...Array(Math.min(25, signups.length - i * 25)).fill().map((a, j) =>
                                        new StringSelectMenuOptionBuilder()
                                            .setLabel(`${signups[i * 25 + j].player_id.username}`)
                                            .setValue(`${signups[i * 25 + j].signup_id}`)
                                    )
                                )
                        )
                ),
                new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId(`editroster-monster-${this.name}-${this.event}`)
                            .setLabel('🛡️ Edit Roster')
                            .setStyle(ButtonStyle.Primary),
                        new ButtonBuilder()
                            .setLabel('🛡️ Verify Raid')
                            .setStyle(ButtonStyle.Success)
                            .setCustomId(`resolve-monster-${this.event}`)
                    ),
                unverifiedClears.length == 0 ? null : new ActionRowBuilder()
                    .addComponents(
                        new StringSelectMenuBuilder()
                            .setCustomId(`membersscreenshot-window-${this.event}`)
                            .setPlaceholder('📷 Upload Tiamat Attendance')
                            .addOptions(
                                unverifiedClears.map(a => 
                                    new StringSelectMenuOptionBuilder()
                                        .setLabel(`Window ${a + 1}`)
                                        .setValue(`${a}`)
                                )
                            )
                    )
            ].filter(a => a != null)
        }
        return [
            new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`editroster-monster-${this.name}-${this.event}`)
                        .setLabel('🛡️ Edit Roster')
                        .setStyle(ButtonStyle.Primary)
                ),
            unverifiedClears.length == 0 ? null : new ActionRowBuilder()
                .addComponents(
                    new StringSelectMenuBuilder()
                        .setCustomId(`membersscreenshot-window-${this.event}`)
                        .setPlaceholder('📷 Upload Tiamat Attendance')
                        .addOptions(
                            unverifiedClears.map(a => 
                                new StringSelectMenuOptionBuilder()
                                    .setLabel(`Window ${a + 1}`)
                                    .setValue(`${a}`)
                            )
                        )
                )
        ].filter(a => a != null);
    }
    async updateMessage() {
        if (this.message == null) {
            try {
                this.message = await this.thread.send({ embeds: this.createEmbeds(), components: this.createButtons() });
                let { error } = await supabase.from(config.supabase.tables.events).update({ channel: this.message.channelId, message: this.message.id }).eq('event_id', this.event);
                if (error) console.log(`Error updating event message: ${error.message}`);
            } catch (err) {
                console.log(`Error sending message for ${this.name}:`, err);
            }
        } else {
            try {
                return await this.message.edit({ embeds: this.createEmbeds(), components: this.createButtons() });
            } catch (err) {
                console.log(`Error updating message for ${this.name}:`, err);
            }
        }
    }
    async updateLeaders() {
        for (let i = 0; i < this.signups.length; i++) {
            for (let j = 0; j < this.signups[i].length; j++) {
                if (this.leaders[i][j] != null && !this.signups[i][j].filter(a => a != null).find(a => a.user.id == this.leaders[i][j].id)) this.leaders[i][j] = null;
                if (this.signups[i][j].filter(a => a == null).length == 0 && this.leaders[i][j] == null) {
                    let candidates = this.signups[i][j].filter(a => a != this.removedLeader[i][j] && jobList.find(b => b.job_id == a.job)?.role_type != 'Tank');
                    if (candidates.length == 0) continue;
                    this.leaders[i][j] = candidates[Math.floor(Math.random() * candidates.length)].user;
                    await this.updateMessage();
                    let embed = new EmbedBuilder()
                        .setTitle('Leader Chosen')
                        .setDescription(`<@${this.leaders[i][j].id}> is now leader of alliance ${i + 1} party ${j + 1}.`)
                    await this.message.reply({ embeds: [embed] });
                }
            }
        }

        let attendance = (this.data.signups ? this.data.signups.map(a => a.signup_id) : this.signups.flat().flat().filter(a => a != null).map(a => a.signupId)).filter((a, i, arr) => arr.slice(0, i).find(b => a == b) == null);
        let { error } = supabase.from(config.supabase.tables.events).update({ attendance }).eq('event_id', this.event);
        if (error) console.log(`Error updating attendance for event ${this.event}: ${error.message}`);
    }
    createVerificationEmbeds() {
        let unverified = this.data.signups.filter(a => a.active && a.verified == null && a.todgrab == null);
        if (unverified.length == 0) {
            return [
                new EmbedBuilder()
                    .setTitle(`${this.data.monster_name.split('_')[0]} Verification Complete`)
                    .setDescription(`<t:${this.timestamp}:d>`)
                    .setThumbnail(`https://mrqccdyyotqulqmagkhm.supabase.co/storage/v1/object/public/${config.supabase.buckets.images}/${this.data.monster_name.split('_')[0].replaceAll(' ', '')}.png`)
                    .setFooter({ text: `Total ${this.data.signups.filter(a => a.active).length} • Reviewed ${this.data.signups.filter(a => a.active && a.verified != null).length}` })
            ]
        } else {
            return new Array(Math.ceil(unverified.length / 25)).fill().map((a, i) => 
                new EmbedBuilder()
                    .setTitle(`${this.data.monster_name.split('_')[0]} Tag Verification`)
                    .setDescription(`<t:${this.timestamp}:d>`)
                    .setThumbnail(`https://mrqccdyyotqulqmagkhm.supabase.co/storage/v1/object/public/${config.supabase.buckets.images}/${this.data.monster_name.split('_')[0].replaceAll(' ', '')}.png`)
                    .addFields(
                        ...new Array(Math.min(unverified.slice(i * 25).length, 25)).fill().map((b, j) =>
                            ({
                                name: `${unverified[i * 25 + j].player_id.username} (${this.calculateBonusPoints(unverified[i * 25 + j])} ${this.getPointType(false)})`,
                                value: unverified[i * 25 + j].screenshot == null ? 'No screenshot uploaded' : `[Screenshot](https://mrqccdyyotqulqmagkhm.supabase.co/storage/v1/object/public/${config.supabase.buckets.screenshots}/${unverified[i * 25 + j].screenshot})`
                            })
                        )
                    )
                    .setFooter({ text: `Total ${this.data.signups.filter(a => a.active).length} • Reviewed ${this.data.signups.filter(a => a.active && a.verified != null).length}` })
            )
        }
    }
    createVerificationComponents() {
        let unverified = this.data.signups.filter(a => a.active == true && a.verified == null);
        if (unverified.length == 0) return [];
        else {
            return [
                ...new Array(Math.ceil(unverified.length / 25)).fill().map((a, i) =>
                        new ActionRowBuilder()
                            .addComponents(
                                new StringSelectMenuBuilder()
                                    .setPlaceholder('🛡️ Verify User')
                                    .setCustomId(`verify-signup-${this.event}-${i}`)
                                    .addOptions(
                                        ...Array(Math.min(25, unverified.length - i * 25)).fill().map((a, j) => 
                                            new StringSelectMenuOptionBuilder()
                                                .setLabel(`${unverified[i * 25 + j].player_id.username}`)
                                                .setValue(`${unverified[i * 25 + j].signup_id}`)
                                        )
                                    )
                            )
                    ),
                new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId(`verify-view-${this.event}`)
                            .setLabel('Preview')
                            .setStyle(ButtonStyle.Primary),
                        new ButtonBuilder()
                            .setCustomId(`verify-verify-${this.event}`)
                            .setLabel('Approve')
                            .setStyle(ButtonStyle.Success),
                        new ButtonBuilder()
                            .setCustomId(`verify-decline-${this.event}`)
                            .setLabel('Decline')
                            .setStyle(ButtonStyle.Danger)
                    ),
                new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId(`verifyall-event-${this.event}`)
                            .setLabel('Approve All')
                            .setStyle(ButtonStyle.Success)
                    )
            ]
        }
    }
    async updatePanel() {
        if (this.panel == null) {
            let channelName = (this.group ? this.group.map(a => a).join('—') : this.name).replaceAll(' ', '-').toLowerCase();
            let channels = [...(await screenshotPanelCategory.guild.channels.fetch(null, { force: true })).values()].filter(a => a.parentId == screenshotPanelCategory.id);
            let channel = channels.find(a => a.name == channelName);
            if (channel == null) {
                try {
                    channel = await screenshotPanelCategory.children.create({
                        name: channelName,
                        type: ChannelType.GuildText
                    });
                } catch (err) {
                    return console.log('Error creating screenshot panel channel:', err);
                }
            }
            try {
                this.panel = await channel.send({ embeds: this.createVerificationEmbeds(), components: this.createVerificationComponents() });
            } catch (err) {
                return console.log('Error sending screenshot verification panel message:', err);
            }
        }
        return await this.panel.edit({ embeds: this.createVerificationEmbeds(), components: this.createVerificationComponents() });
    }
    async close() {
        let data;
        let error;
        if (config.supabase.trackedRates.includes(this.name)) {
            ({ error } = await supabase.from(config.supabase.tables.claims).insert({ linkshell_name: this.killer, monster_name: this.name }));
            if (error) return { error };

            ({ error } = await supabase.from(config.supabase.tables.deaths).insert({ monster_name: this.name }));
            if (error) return { error };
        }
        
        if (this.todGrabber != null) {
            ({ error } = await supabase.from(config.supabase.tables.signups).insert({ event_id: this.event, player_id: this.todGrabber.id, active: true, todgrab: true }));
            if (error) return { error };
        }
        
        ({ data, error } = await supabase.from(config.supabase.tables.signups).select('*, player_id (id, username)').eq('event_id', this.event));
        if (error) return { error };
        this.data.signups = data;


        ({ error } = await supabase.from(config.supabase.tables.events).update({ active: false, verified: this.data.signups.length == 0, close_date: new Date() }).eq('event_id', this.event));
        if (error) return { error };
        this.active = false;
        this.verified = this.data.signups.length == 0;
        this.closeDate = new Date();

        await this.updateMessage();
        delete monsters[this.name];
        if (this.group) delete monsters[this.group.join('/')];
        if (this.verified) {
            delete archive[this.event];
            let embed = new EmbedBuilder()
                .setDescription(`${this.name} roster closed with no signups, marked as verified`)
            await logChannel.send({ embeds: [embed] });
        }

        await this.updatePanel();

        for (let signup of this.data.signups.filter(a => a.active)) {
            let user = signup.player_id;
            if (this.name == 'Tiamat') signup.windows = this.data.signups.filter(a => a.player_id.id == user.id).length;
        }

        await updateClaimRates();

        if (this.data.signups.length == 0) setTimeout(this.message.delete, 60 * 60 * 1000);
    }
}

const bidQueue = [];
const blockedBids = [];
const blockBid = (id, callback) => blockedBids.push({ id, callback });
const unblockBid = (id) => blockedBids = blockedBids.filter(a => a.id != id);
const handleBidQueue = async () => {
    for (let bid of blockedBids) if (bidQueue.find(a => a.id == bid.id) == null) bid.callback();
    if (bidQueue.length) await bidQueue.splice(0, 1)[0].func();
    setTimeout(handleBidQueue);
}
handleBidQueue();

async function getUser(id) {
    let { data: user, error } = await supabase.from(config.supabase.tables.users).select('*').eq('id', id).limit(1);
    return error ? { error } : user[0];
}

function calculateCampPoints(campRules, monster, windows, totalWindows) {
    let campRule = campRules.find(a => a.monster_name == monster);
    if (campRule == null) throw Error(`Couldn't find camp point rule for monster "${monster}"`);
    else {
        let points = 0;
        if (campRule.bonus_windows) points += Math.min(Math.floor(windows / campRule.bonus_windows) * campRule.bonus_points, campRule.max_bonus);
        let diff = totalWindows - windows;
        if (windows > 0) points += campRule.camp_points[campRule.camp_points.length - 1 - diff] || 0;
        return points;
    }
}

function calculateBonusPoints(pointRules, signup, type) {
    let bonusRules = pointRules.filter(a => a.monster_type == type);
    let dkp = 0;
    let ppp = 0;
    if (signup.tagged) {
        let rule = bonusRules.find(a => a.point_code == 't');
        if (rule == null) throw Error(`Couldn't find tag point rule for monster type "${type}"`);
        dkp += rule.dkp_value;
        ppp += rule.ppp_value;
    }
    if (signup.killed) {
        let rule = bonusRules.find(a => a.point_code == 'k');
        if (rule == null) throw Error(`Couldn't find kill point rule for monster type "${type}"`);
        dkp += rule.dkp_value;
        ppp += rule.ppp_value;

        if (signup.rage) {
            let rule = bonusRules.find(a => a.point_code == 'r');
            if (rule == null) throw Error(`Couldn't find rage point rule for monster type "${type}"`);
            dkp += rule.dkp_value;
            ppp += rule.ppp_value;
        }
    }
    
    return dkp || ppp;
}

async function openAuction(item, host) {
    let auction;
    ({ data: auction, error } = await supabase.from(config.supabase.tables.auctions).select('*').eq('item', item).eq('open', true).limit(1));
    if (error) return { error: 'Error Checking Auctions', details: error.message };
    if (auction.length != 0) return;
    
    ({ data: auction, error } = await supabase.from(config.supabase.tables.auctions).insert({ item, host }).select('*'));
    if (error) return { error: 'Error Creating Auction', details: error.message };
    unblockBid(auction.id);
    return auction[0];
}

async function closeAuction(id) {
    let { data: auction, error } = await supabase.from(config.supabase.tables.auctions).select('*, item (name, type, monster)').eq('id', id).limit(1);
    if (error) return { error: 'Error Fetching Auction', details: error.message };
    auction = auction[0];
    if (auction == null) return { code: 400, error: `Couldn't find auction with id "${id}"` };
    
    if (!auction.open) return { code: 400, error: 'Auction Already Closed' };

    await util.promisify(blockBid)(auction.id);

    let winners = auction.bids.filter(a => a.amount == auction.bids[auction.bids.length - 1].amount);
    let winner;
    if (winners.length > 1) {
        do {
            winners.forEach(a => delete a.roll);
            for (let item of winners) {
                await message.edit({ embeds: [rollEmbed] });
                do {
                    item.roll = Math.floor(Math.random() * 1000);
                } while (winners.filter(a => a.roll == item.roll).length > 1);
            }
            winner = winners.reduce((a, b) => (a == null || b.roll > a.roll) ? b : a, null);
        } while (!(winners.find(a => a.wipe) == null || winner.wipe));
    } else winner = winners.sort((a, b) => b.amount - a.amount)[0];

    ({ data: auction, error } = await supabase.from(config.supabase.tables.auctions).update({
        open: false,
        end: 'now()',
        winner: winner?.user,
        price: winner?.amount,
        closer: user.username
    }).eq('id', auction.id).select('*, item (name, type, monster)'));
    if (error) return { error: 'Error Closing Auction', details: error.message };
    auction = auction[0];
    
    if (winner) {
        ({ error } = await supabase.from(config.supabase.tables[auction.item.type].lootHistory).insert({
            user: winner.user,
            item: auction.item.name,
            points_spent: winner.amount,
            auction: auction.id
        }));
        if (error) return { error: 'Error Updating Loot History', details: error.message };
    }

    if (auction.bids.length > 0) {
        ({ error } = await supabase.rpc('increment_points', {
            table_name: config.supabase.tables.users,
            id: winner.userId,
            type: auction.item.type.toLowerCase(),
            amount: -winner.amount
        }))
        if (error) return { error: 'Error Removing Points', details: error.message };
    }

    return auction;
}

export {
    config,
    client,
    supabase,
    blockBid,
    unblockBid,
    blockedBids,
    bidQueue,
    // auctions,
    // auctionChannels,
    // rollChannel,
    // itemList,
    // monsterList,
    // userList,
    // jobList,
    // templateList,
    // campRules,
    // pointRules,
    // groupList,
    // tagList,
    // lootHistory,
    // eventList,
    // signupList,
    // monsters,
    // archive,
    // rosterChannels,
    // ocrCategory,
    // logChannel,
    // memberScreenshotsChannel,
    // rewardHistoryChannel,
    // graphChannels,
    Monster,
    // updateTagRates,
    // updateGraphs,
    // messageCallbacks,
    getUser,
    calculateCampPoints,
    calculateBonusPoints,
    openAuction,
    closeAuction
}