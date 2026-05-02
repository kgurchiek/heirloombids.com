import { config, supabase, openAuction } from '../lib.js';

export default {
    name: 'open-monster',
    description: 'opens auctions on all of a monster\'s items',
    options: [
        {
            name: 'monster',
            description: 'the monster whose items to auction',
            required: true
        }
    ],
    async execute({ res, end, url, user }) {
        let monster = url.searchParams.get('monster');
        let { data: items, error } = await supabase.from(config.supabase.tables.items).select('*').eq('monster', monster);
        if (error) return end(500, { error: 'Error Fetching Items', details: error.message });

        if (items.length == 0) return end(400, { error: `Couldn\'t find items for monster "${monster}".` })

        if (user.frozen) return end(403, { error: 'Account Frozen', details: 'Your account is frozen. You cannot manage auctions or place bids on items this time.' });
    
        let errors = [];
        let auctions = [];
        for (let item of items) {
            auction = await openAuction(item.name, user.username);
            if (auction == null) continue;
            if (auction.error) errors.push(auction);
            else auctions.push(auction);
        }
        res.end({ errors, auctions });
    }
}