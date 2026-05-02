import fs from 'node:fs';
import util from 'node:util';
import { createClient } from '@supabase/supabase-js';
import { Client, Partials, GatewayIntentBits } from 'discord.js';
import config from './config.json' with { type: 'json' };

let publicKey, privateKey;
try {
    publicKey = (await fs.promises.readFile(config.jwt.publicKey)).toString();
    privateKey = (await fs.promises.readFile(config.jwt.privateKey)).toString();
} catch (err) {}

const client = new Client({ partials: [Partials.Channel, Partials.GuildMember, Partials.Message], intents: [GatewayIntentBits.Guilds, GatewayIntentBits.DirectMessages, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildMessages] });
const supabase = createClient(config.supabase.url, config.supabase.key);

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

let cachedTables = [
    config.supabase.tables.users,
    config.supabase.tables.items,
    config.supabase.tables.jobs,
    config.supabase.tables.templates,
    config.supabase.tables.campRules,
    config.supabase.tables.pointRules
]
let supabaseCache = {};
async function updateCache() {
    let hadError = false;
    await Promise.all(cachedTables.map(table => (async () => {
        try {
            let { data, error } = await supabase.from(table).select('*');
            if (error == null) {
                supabaseCache[table] = data;
                // console.log(`[Supabase Cache]: Fetched ${data.length} rows from ${table}.`);
            } else {
                hadError = true;
                console.log(`[Supabase Cache]: Error fetching ${table}`, error.message == null ? '' : `: ${(error.message.includes('<!DOCTYPE html>') || error.message.includes('<html>')) ? 'Server Error' : error.message}`);
            }
        } catch (err) {
            hadError = true;
            console.log(`[Supabase Cache]: Error fetching ${table}:`, err);
        }
    })()));
    
    setTimeout(updateCache, 5000);
    return hadError;
}

async function getUser(id) {
    let { data: user, error } = await supabase.from(config.supabase.tables.users).select('*').eq('id', id).limit(1);
    return error ? { error } : user[0];
}

function calculateCampPoints(monster, windows, totalWindows) {
    let campRule = supabaseCache[config.supabase.tables.campRules].find(a => a.monster_name == monster);
    if (campRule == null) throw Error(`Couldn't find camp point rule for monster "${monster}"`);
    if (windows == 0) return { type: campRule.type, points: 0 };
    let points = 0;
    if (campRule.bonus_windows) points += Math.min(Math.floor(windows / campRule.bonus_windows) * campRule.bonus_points, campRule.max_bonus);
    if (totalWindows == null) points += campRule.camp_points[Math.min(windows - 1, campRule.camp_points.length)];
    else {
        let diff = totalWindows - windows;
        points += campRule.camp_points[Math.min(campRule.camp_points.length - 1 - diff, campRule.camp_points.length)];
    }
    return { type: campRule.type, points };
}

function calculateBonusPoints(signup, type) {
    let bonusRules = supabaseCache[config.supabase.tables.pointRules].filter(a => a.monster_type == type);
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
    
    return { type: dkp ? 'DKP' : 'PPP', points: dkp || ppp };
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
    publicKey,
    privateKey,
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
    // Monster,
    // updateTagRates,
    // updateGraphs,
    // messageCallbacks,
    getUser,
    calculateCampPoints,
    calculateBonusPoints,
    openAuction,
    closeAuction,
    updateCache,
    supabaseCache
}