export default {
    name: 'openitem',
    description: 'opens an auction on an item',
    options: [
        {
            name: 'item',
            description: 'the item to open an auction on',
            required: true
        }
    ],
    async execute({ config, res, url, supabase, user, unblockBid }) {
        let itemName = url.searchParams.get('item');
        let { data: item, error } = await supabase.from(config.supabase.tables.items).select('*').eq('name', itemName).eq('available', true).limit(1);
        if (error) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: 'Error Fetching Item', details: error.message }));
            return;
        }
        item = item[0];

        if (item == null) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: `Item "${itemName}" not found.` }))
            return;
        }

        if (user.frozen) {
            res.statusCode = 403;
            res.end(JSON.stringify({ error: 'Account Frozen', details: 'Your account is frozen. You cannot manage auctions or place bids on items this time.' }));
            return;
        }
    
        let auction;
        ({ data: auction, error } = await supabase.from(config.supabase.tables.auctions).select('*').eq('item', item.name).eq('open', true).limit(1));
        if (error) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: 'Error Checking Auctions', details: error.message }));
            return;
        }
        if (auction.length != 0) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: `Auction for "${item.name}" is already open.` }));
            return;
        }
        
        ({ data: auction, error } = await supabase.from(config.supabase.tables.auctions).insert({ item: item.name, host: user.username }).select('*'));
        if (error) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: 'Error Creating Auction', details: error.message }));
            return;
        }
        auction = auction[0];
        unblockBid(auction.id);
        res.end(JSON.stringify(auction));
    }
}