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
        }
    ],
    async execute({ config, res, url, user, supabase, blockedBids, bidQueue }) {
        let id = url.searchParams.get('id');
        let amount = url.searchParams.get('amount');
        
        if (user.frozen) {
            const errorEmbed = new EmbedBuilder()
                .setColor('#ff0000')
                .setTitle('Account Frozen')
                .setDescription('Your account is frozen. You cannot manage auctions or place bids on items this time.');
            await interaction.editReply({ embeds: [errorEmbed] });
            return;
        }
        
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
            res.end(JSON.stringify({ error: 'Auction Closed' }));
            return;
        }
        
        if (isNaN(parseFloat(amount))) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: 'Invalid value for arg "amount"', details: `"${amount}" is not a number` }));
            return;
        }
        amount = parseFloat(amount);

        bidQueue.push({
            id,
            func: async () => {
                if (blockedBids.find(a => a.id == id)) {
                    res.statusCode = 400;
                    res.end(JSON.stringify({ error: 'Auction Closed' }));
                    return;
                }

                if (auction.bids.find(a => a.user == user.username && a.amount == amount)) {
                    res.statusCode = 400;
                    res.end(JSON.stringify({ error: 'Duplicate Bid', details: `You have already placed a bid of ${amount} ${auction.item.type} on ${auction.item.name}.` }));
                    return;
                }

                let { data: userBids, error } = await supabase.from(config.supabase.tables.auctions).select('*, item!inner(name, type, monster, tradeable), winner, price, host, start').eq('open', true).eq('item.type', auction.item.type).neq('item.name', auction.item.name).like('winner', `%${user.username}%`);
                if (error) {
                    res.statusCode = 500;
                    res.end(JSON.stringify({ error: 'Error Fetching User\'s Bids', details: error.message }));
                    return;
                }
                userBids = userBids.filter(a => a.winner.split(', ').includes(user.username));
                let cost = userBids.reduce((a, b) => a + b.price, 0);
                if (auction.item.wipe) {
                    for (let auction of userBids) {
                        auction.bids = auction.bids.filter(a => a.user != user.username);
                        while (true) {
                            if (auction.bids.length == 0) break;
                            let { data: newWinner, error } = await supabase.from(config.supabase.tables.users).select('id::text, username, dkp, ppp').eq('username', auction.bids[auction.bids.length - 1].user);
                            if (error) {
                                res.statusCode = 500;
                                res.end(JSON.stringify({ error: 'Error Fetching New Winner', details: error.message }));
                                return;
                            }
                            newWinner = newWinner[0];
                            
                            ({ data: userBids, error } = await supabase.from(config.supabase.tables.auctions).select('id, bids, item!inner(name, type, monster), winner, price, host').eq('open', true).eq('item.type', auction.item.type).like('winner', `%${newWinner.username}%`));
                            if (error) {
                                res.statusCode = 500;
                                res.end(JSON.stringify({ error: 'Error Fetching New Winner\'s Bids', details: error.message }));
                                return;
                            }
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
                        if (error) {
                            res.statusCode = 500;
                            res.end(JSON.stringify({ error: 'Error Deleting User\'s Bids', details: error.message }));
                            return;
                        }
                        auction.bids.sort((a, b) => b.amount - a.amount);
                    }
                    amount = user[auction.item.type.toLowerCase()];
                }

                let { min, increment, raise, winRaise } = config.auction[auction.item.type];
                min = auction.bids[auction.bids.length - 1]?.amount || min - raise;
                if (Math.round((user[auction.item.type.toLowerCase()] - (auction.item.wipe ? 0 : cost)) / increment) * increment < amount) {
                    res.statusCode = 400;
                    res.end(JSON.stringify({ error: 'Insufficient Funds', details: `You only have ${(author[auction.item.type.toLowerCase()] - cost).toFixed(1)} ${auction.item.type} left to bid on ${auction.item.name}${cost == 0 ? '' : ` (You're currently spending ${cost} ${auction.item.type} on ${userBids.length} auction${userBids.length == 1 ? '' : 's'})`}.` }));
                    return;
                }

                if (auction.item.wipe) raise = increment;
                if (Math.abs(Math.round((amount % increment) * 10) - ((amount % increment) * 10)) > 0.00001) {
                    res.statusCode = 400;
                    res.end(JSON.stringify({ error: 'Invalid Bid Amount', details: `${auction.item.type} bids must be in increments of ${increment}.` }));
                    return;
                }
                
                if (amount < Math.round((min + raise) * 10) / 10 && !(amount >= min + winRaise && amount == user[auction.item.type.toLowerCase()])) {
                    res.statusCode = 400;
                    res.end(JSON.stringify({ error: 'Bid Too Low', details: `You must bid at least ${Math.round((min + raise) * 10) / 10} ${auction.item.type} to outbid the current highest bidder.` }));
                    return;
                }

                if (auction.bids.length > 0 && amount == min && auction.item.tradeable) {
                    res.statusCode = 400;
                    res.end(JSON.stringify({ error: 'Bid Too Low', details: 'You can\'t tie on a tradeable item.' }));
                    return;
                }

                auction.bids.push({ userId: author.id, user: user.username, amount, wipe: amount == user[auction.item.type.toLowerCase()] });
                ({ data: auction, error } = await supabase.from(config.supabase.tables.auctions).update({
                    bids: auction.bids,
                    winner: auction.bids.filter(a => a.amount == amount).map(a => a.user).join(', '),
                    price: amount
                }).eq('id', auction.id).select('*'));
                if (error) {
                    res.statusCode = 500;
                    res.end(JSON.stringify({ error: 'Error Placing Bid', details: error.message }));
                    return;
                }
                res.end(JSON.stringify(auction[0]));
            }
        });
    }
}