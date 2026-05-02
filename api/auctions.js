import { config, supabase } from '../lib.js';

export default {
    name: 'auctions',
    description: 'Gets a list of auctions',
    options: [
        {
            name: 'open',
            description: 'whether or not the auction is open',
            accepts: ['true', 'false'],
            caseInsensitive: true
        },
        {
            name: 'limit',
            description: 'How many auctions to fetch'
        }
    ],
    async execute({ res, end, url }) {
        let open = url.searchParams.get('open');
        let limit = url.searchParams.get('limit');
        if (limit != null) {
            if (isNaN(parseInt(limit))) return end(400, JSON.stringify({ error: 'Invalid value for arg "limit"', details: `"${limit}" is not a number` }));
            limit = parseInt(limit);
        }

        let promise = supabase.from(config.supabase.tables.auctions).select('*')
        if (open != null) promise = promise.eq('open', open);
        if (limit != null) promise = promise.limit(limit).order('start', { ascending: false });
        let { data: auctions, error } = await promise;
        if (error) return end(500, JSON.stringify({ error: 'Error fetching auctions', details: error.message }));

        res.end(JSON.stringify(auctions));
    }
}