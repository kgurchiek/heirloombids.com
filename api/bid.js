import { config, supabase, blockedBids, bidQueue } from '../lib.js';

export default {
    name: 'bid',
    description: 'places a bid on an item',
    options: [
        {
            name: 'id',
            description: 'the id of the auction to bid on',
            required: true
        },
        {
            name: 'amount',
            desciption: 'how much to bid',
            required: true
        },
        {
            name: 'username',
            description: 'The user to bid for (staff only)'
        }
    ],
    async execute({ res, end, url, user }) {
        let id = url.searchParams.get('id');
        let amount = url.searchParams.get('amount');
        let username = url.searchParams.get('user');
        if (user.staff == false && username != null) return end(403, { error: 'Staff Only', details: `Only staff can place bids for other users` });
        if (username == null) username = user.username;
        
        if (user.frozen) return end(403, JSON.stringify({ error: 'Account Frozen', details: 'Your account is frozen. You cannot manage auctions or place bids on items this time.' }));
        
        let { data: auction, error } = await supabase.from(config.supabase.tables.auctions).select('*, item (name, type, monster)').eq('id', id).limit(1);
        if (error) return end(500, JSON.stringify({ error: 'Error Fetching Auction', details: error.message }));
        auction = auction[0];
        if (auction == null) return end(400, JSON.stringify({ error: `Couldn't find auction with id "${id}"` }));
        
        if (!auction.open) return end(400, JSON.stringify({ error: 'Auction Closed' }));
        
        if (isNaN(parseFloat(amount))) return end(400, JSON.stringify({ error: 'Invalid value for arg "amount"', details: `"${amount}" is not a number` }));
        amount = parseFloat(amount);

        bidQueue.push({
            id,
            func: async () => {
                if (blockedBids.find(a => a.id == id)) await end(400, JSON.stringify({ error: 'Auction Closed' }));

                if (auction.bids.find(a => a.user == username && a.amount == amount)) return end(400, JSON.stringify({ error: 'Duplicate Bid', details: `You have already placed a bid of ${amount} ${auction.item.type} on ${auction.item.name}.` }));

                let { data: userBids, error } = await supabase.from(config.supabase.tables.auctions).select('*, item!inner(name, type, monster, tradeable), winner, price, host, start').eq('open', true).eq('item.type', auction.item.type).neq('item.name', auction.item.name).like('winner', `%${username}%`);
                if (error) return end(500, JSON.stringify({ error: 'Error Fetching User\'s Bids', details: error.message }));
                userBids = userBids.filter(a => a.winner.split(', ').includes(username));
                let cost = userBids.reduce((a, b) => a + b.price, 0);
                
                if (auction.item.wipe) {
                    for (let auction of userBids) {
                        auction.bids = auction.bids.filter(a => a.user != username);
                        while (true) {
                            if (auction.bids.length == 0) break;
                            let { data: newWinner, error } = await supabase.from(config.supabase.tables.users).select('id::text, username, dkp, ppp').eq('username', auction.bids[auction.bids.length - 1].user);
                            if (error) return end(500, JSON.stringify({ error: 'Error Fetching New Winner', details: error.message }));
                            newWinner = newWinner[0];
                            
                            ({ data: userBids, error } = await supabase.from(config.supabase.tables.auctions).select('id, bids, item!inner(name, type, monster), winner, price, host').eq('open', true).eq('item.type', auction.item.type).like('winner', `%${newWinner.username}%`));
                            if (error) return end(500, JSON.stringify({ error: 'Error Fetching New Winner\'s Bids', details: error.message }));
                            userBids = userBids.filter(a => a.winner.split(', ').includes(newWinner.username));
                            let cost = userBids.reduce((a, b) => a + b.price, 0) + auction.bids[auction.bids.length - 1].amount;
                            if (cost > newWinner[auction.item.type.toLowerCase()]) auction.bids = auction.bids.slice(0, auction.bids.length - 1);
                            else break;
                        }
                        ({ data: bids, error } = await supabase.from(config.supabase.tables.auctions).update({
                            bids: auction.bids,
                            winner: auction.bids.length == 0 ? null : auction.bids.filter(a => a.amount == auction.bids[auction.bids.length - 1].amount).map(a => a.user).join(', '),
                            price: auction.bids.length == 0 ? null : auction.bids[auction.bids.length - 1].amount
                        }).eq('id', auction.id));
                        if (error) return end(500, JSON.stringify({ error: 'Error Deleting User\'s Bids', details: error.message }));
                        auction.bids.sort((a, b) => b.amount - a.amount);
                    }
                    amount = user[auction.item.type.toLowerCase()];
                }

                let { min, increment, raise, winRaise } = config.auction[auction.item.type];
                min = auction.bids[auction.bids.length - 1]?.amount || min - raise;
                if (Math.round((user[auction.item.type.toLowerCase()] - (auction.item.wipe ? 0 : cost)) / increment) * increment < amount) return end(400, JSON.stringify({ error: 'Insufficient Funds', details: `You only have ${(user[auction.item.type.toLowerCase()] - cost).toFixed(1)} ${auction.item.type} left to bid on ${auction.item.name}${cost == 0 ? '' : ` (You're currently spending ${cost} ${auction.item.type} on ${userBids.length} auction${userBids.length == 1 ? '' : 's'})`}.` }));

                if (auction.item.wipe) raise = increment;
                if (Math.abs(Math.round((amount % increment) * 10) - ((amount % increment) * 10)) > 0.00001) return end(400, JSON.stringify({ error: 'Invalid Bid Amount', details: `${auction.item.type} bids must be in increments of ${increment}.` }));
                
                if (amount < Math.round((min + raise) * 10) / 10 && !(amount >= min + winRaise && amount == user[auction.item.type.toLowerCase()])) return end(400, JSON.stringify({ error: 'Bid Too Low', details: `You must bid at least ${Math.round((min + raise) * 10) / 10} ${auction.item.type} to outbid the current highest bidder.` }));

                if (auction.bids.length > 0 && amount == min && auction.item.tradeable) return end(400, JSON.stringify({ error: 'Bid Too Low', details: 'You can\'t tie on a tradeable item.' }));

                auction.bids.push({ userId: user.id, user: username, amount, wipe: amount == user[auction.item.type.toLowerCase()] });
                ({ data: auction, error } = await supabase.from(config.supabase.tables.auctions).update({
                    bids: auction.bids,
                    winner: auction.bids.filter(a => a.amount == amount).map(a => a.user).join(', '),
                    price: amount
                }).eq('id', auction.id).select('*'));
                if (error) return end(500, JSON.stringify({ error: 'Error Placing Bid', details: error.message }));
                
                res.end(JSON.stringify(auction[0]));
            }
        });
    }
}