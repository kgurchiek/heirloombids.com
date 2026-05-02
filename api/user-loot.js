import { config, supabase } from '../lib.js';

export default {
    name: 'user-loot',
    description: 'Gets a user\'s loot history',
    options: [
        {
            name: 'user',
            description: 'The name of the user',
            required: true
        },
        {
            name: 'currency',
            description: 'The currency types of the items',
            required: true,
            accepts: ['dkp', 'ppp'],
            caseInsensitive: true
        }
    ],
    async execute({ res, end, url }) {
        let user = url.searchParams.get('user');
        let currency = url.searchParams.get('currency');
        
        let { data: loot, error } = await supabase.from(config.supabase.tables[currency.toUpperCase()].lootHistory).select('*').eq('user', user);
        if (error) return end(500, JSON.stringify({ error: 'Error fetching user', details: error.message }));

        res.end(JSON.stringify(loot));
    }
}