import { config, supabase, openAuction } from '../lib.js';

export default {
    name: 'open-item',
    description: 'opens an auction on an item',
    options: [
        {
            name: 'item',
            description: 'the item to open an auction on',
            required: true
        }
    ],
    async execute({ res, end, url, user }) {
        let itemName = url.searchParams.get('item');
        let { data: item, error } = await supabase.from(config.supabase.tables.items).select('*').eq('name', itemName).eq('available', true).limit(1);
        if (error) return end(500, { error: 'Error Fetching Item', details: error.message });
        item = item[0];

        if (item == null) return end(400, { error: `Item "${itemName}" not found.` });
        if (user.frozen) return end(403, { error: 'Account Frozen', details: 'Your account is frozen. You cannot manage auctions or place bids on items this time.' });
    
        let auction = await openAuction(item.name, user.username);
        if (auction == null) return end(400, { error: `Auction for "${item}" is already open.` });
        if (auction.error) return end(auction.code || 500, auction);
        res.end(JSON.stringify(auction));
    }
}