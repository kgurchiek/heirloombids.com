import util from 'node:util';
import { EmbedBuilder } from 'discord.js';

export default {
    name: 'closeauction',
    description: 'closes an auction',
    options: [
        {
            name: 'id',
            description: 'the id of the auction to close',
            required: true
        }
    ],
    async execute({ config, res, url, supabase, user, blockBid, rollChannel }) {
        let id = url.searchParams.get('id');

        let { data: auction, error } = await supabase.from(config.supabase.tables.auctions).select('*, item (name, type, monster)').eq('id', id).limit(1);
        if (error) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: 'Error Fetching Auction', details: error.message }));
            return;
        }
        auction = auction[0];
        if (auction == null) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: `Couldn't find auction with id "${id}"` }));
            return;
        }
        
        if (!auction.open) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: 'Auction Already Closed' }));
            return;
        }

        await util.promisify(blockBid)(auction.id);

        if (user.frozen) {
            res.statusCode = 403;
            res.end(JSON.stringify({ error: 'Account Frozen', details: 'Your account is frozen. You cannot manage auctions or place bids on items this time.' }));
            return;
        }

        let winners = auction.bids.filter(a => a.amount == auction.bids[auction.bids.length - 1].amount);
        let winner;
        if (winners.length > 1) {
            let rollEmbed = new EmbedBuilder()
                .setColor('#00ff00')
                .setTitle(`Rolls for ${auction.item.name}${winners.filter(a => a.wipe).length == 1 ? ` (Forcing winner to ${winners.find(a => a.wipe).user})` : ''}`);
            let message = await rollChannel.send({ embeds: [rollEmbed] });
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
            for (let item of winners) {
                rollEmbed.data.description = `${rollEmbed.data.description || ''}\n${item.user}: ${item.roll}`.trim();
                await message.edit({ embeds: [rollEmbed] });
            }
            rollEmbed.data.description += `\n\n**Winner:** ${winner.user}`;
            await message.edit({ embeds: [rollEmbed] });
        } else winner = winners.sort((a, b) => b.amount - a.amount)[0];

        ({ data: auction, error } = await supabase.from(config.supabase.tables.auctions).update({
            open: false,
            end: 'now()',
            winner: winner?.user,
            price: winner?.amount,
            closer: user.username
        }).eq('id', auction.id).select('*, item (name, type, monster)'));
        if (error) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: 'Error Closing Auction', details: error.message }));
            return;
        }
        auction = auction[0];
        
        if (winner) {
            ({ error } = await supabase.from(config.supabase.tables[auction.item.type].lootHistory).insert({
                user: winner.user,
                item: auction.item.name,
                points_spent: winner.amount,
                auction: auction.id
            }));
            if (error) {
                res.statusCode = 500;
                res.end(JSON.stringify({ error: 'Error Updating Loot History', details: error.message }));
                return;
            }
        }

        if (auction.bids.length > 0) {
            ({error} = await supabase.rpc('increment_points', {
                table_name: config.supabase.tables.users,
                id: winner.userId,
                type: auction.item.type.toLowerCase(),
                amount: -winner.amount
            }))
            if (error) {
                res.statusCode = 500;
                res.end(JSON.stringify({ error: 'Error Removing Points', details: error.message }));
                return;
            }
        }

        res.end(JSON.stringify(auction));
    }
}