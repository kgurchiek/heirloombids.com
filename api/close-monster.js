import { config, supabase } from '../lib.js';

export default {
    name: 'close-monster',
    description: 'closes all auctions on a monster\'s items',
    options: [
        {
            name: 'monster',
            description: 'the monster whose auctions to close',
            required: true
        }
    ],
    async execute({ res, end, url, user }) {
        let monster = url.searchParams.get('monster');

        let { data: auctions, error } = await supabase.from(config.supabase.tables.auctions).select('id, item!inner(name, monster)').eq('item.monster', monster).eq('open', true);
        if (error) return end(500, JSON.stringify({ error: 'Error Fetching Auctions', details: error.message }));

        if (user.frozen) return end(403, JSON.stringify({ error: 'Account Frozen', details: 'Your account is frozen. You cannot manage auctions or place bids on items this time.' }));
        
        let errors = [];
        let closes = [];
        for (let auction of auctions) {
            auction = await closeAuction(auction.id);
            if (auction.error) errors.push(auction);
            else res.end(JSON.stringify(auction));
        }

        res.end(JSON.stringify({ errors, closes }));
    }
}