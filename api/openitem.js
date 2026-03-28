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
    async execute({ config, res, end, url, supabase, user, unblockBid }) {
        let itemName = url.searchParams.get('item');
        let { data: item, error } = await supabase.from(config.supabase.tables.items).select('*').eq('name', itemName).eq('available', true).limit(1);
        if (error) return end(500, JSON.stringify({ error: 'Error Fetching Item', details: error.message }));
        item = item[0];

        if (item == null) return end(400, JSON.stringify({ error: `Item "${itemName}" not found.` }))

        if (user.frozen) return end(403, JSON.stringify({ error: 'Account Frozen', details: 'Your account is frozen. You cannot manage auctions or place bids on items this time.' }));
    
        let auction;
        ({ data: auction, error } = await supabase.from(config.supabase.tables.auctions).select('*').eq('item', item.name).eq('open', true).limit(1));
        if (error) return end(500, JSON.stringify({ error: 'Error Checking Auctions', details: error.message }));
        if (auction.length != 0) return end(400, JSON.stringify({ error: `Auction for "${item.name}" is already open.` }));
        
        ({ data: auction, error } = await supabase.from(config.supabase.tables.auctions).insert({ item: item.name, host: user.username }).select('*'));
        if (error) return end(500, JSON.stringify({ error: 'Error Creating Auction', details: error.message }));
        auction = auction[0];
        unblockBid(auction.id);
        res.end(JSON.stringify(auction));
    }
}