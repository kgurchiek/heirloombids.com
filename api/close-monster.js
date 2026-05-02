import { config, supabase, closeAuction } from '../lib.js';

export default {
    name: 'close-monster',
    description: 'closes all auctions on a monster\'s items',
    options: [
        {
            name: 'monster',
            description: 'the monster whose auctions to close',
            required: true
        },
        {
            name: 'tradeable',
            description: 'Open only tradeable or non-tradeable items',
            accepts: ['true', 'false'],
            caseInsensitive: true
        }
    ],
    async execute({ res, end, url, user }) {
        let monster = url.searchParams.get('monster');
        let tradeable = url.searchParams.get('tradeable');

        let promise = supabase.from(config.supabase.tables.auctions).select('id, item!inner(name, monster, tradeable)').eq('item.monster', monster).eq('open', true);
        if (tradeable != null) promise = promise.eq('item.tradeable', tradeable == 'true');
        let { data: auctions, error } = await promise;
        if (error) return end(500, JSON.stringify({ error: 'Error Fetching Auctions', details: error.message }));

        if (user.frozen) return end(403, JSON.stringify({ error: 'Account Frozen', details: 'Your account is frozen. You cannot manage auctions or place bids on items this time.' }));
        
        let errors = [];
        let closes = [];
        for (let auction of auctions) {
            auction = await closeAuction(auction.id, user.username);
            if (auction.error) errors.push(auction);
            closes.push(auction);
        }

        res.end(JSON.stringify({ errors, closes }));
    }
}