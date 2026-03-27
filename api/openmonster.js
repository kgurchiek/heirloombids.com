export default {
    name: 'openmonster',
    description: 'opens auctions on all of a monster\'s items',
    options: [
        {
            name: 'monster',
            description: 'the monster whose items to auction',
            required: true
        }
    ],
    async execute({ config, res, url, supabase, user, unblockBid }) {
        let monster = url.searchParams.get('monster');
        let { data: items, error } = await supabase.from(config.supabase.tables.items).select('*').eq('monster', monster);
        if (error) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: 'Error Fetching Items', details: error.message }));
            return;
        }

        if (items.length == 0) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: `Couldn\'t find items for monster "${monster}".` }))
            return;
        }

        if (user.frozen) {
            res.statusCode = 403;
            res.end(JSON.stringify({ error: 'Account Frozen', details: 'Your account is frozen. You cannot manage auctions or place bids on items this time.' }));
            return;
        }
    
        let errors = [];
        let auctions = [];
        for (let item of items) {
            let auction;
            ({ data: auction, error } = await supabase.from(config.supabase.tables.auctions).select('*').eq('item', item.name).eq('open', true).limit(1));
            if (error) {
                res.end(JSON.stringify({ error: 'Error Checking Auctions', details: error.message }));
                continue;
            }
            if (auction.length != 0) continue;
            
            ({ data: auction, error } = await supabase.from(config.supabase.tables.auctions).insert({ item: item.name, host: user.username }).select('*'));
            if (error) {
                errors.push({ error: 'Error Creating Auction', details: error.message });
                continue;
            }
            auction = auction[0];
            unblockBid(auction.id);
            auctions.push(auction);
        }
        res.end(JSON.stringify({ errors, auctions }));
    }
}