import { config, supabase } from '../lib.js';

export default {
    name: 'loot-history',
    description: 'Gets recent loot history',
    options: [
        {
            name: 'item',
            description: 'The name of the item to get loot history of'
        },
        {
            name: 'currency',
            description: 'The currency types of the items',
            accepts: ['dkp', 'ppp', 'all', null],
            caseInsensitive: true
        },
        {
            name: 'limit',
            description: 'How many rows to fetch'
        }
    ],
    async execute({ res, end, url }) {
        let item = url.searchParams.get('item');
        let currency = url.searchParams.get('currency') || 'all';
        let limit = url.searchParams.get('limit');
        if (limit != null) {
            if (isNaN(parseInt(limit))) return end(400, JSON.stringify({ error: 'Invalid value for arg "limit"', details: `"${limit}" is not a number` }));
            limit = parseInt(limit);
        }

        let allLoot = [];
        let currencies = currency == 'all' ? ['DKP', 'PPP'] : [currency.toUpperCase()];
        for (let currency of currencies) {
            let promise = supabase.from(config.supabase.tables[currency].lootHistory).select('*');
            if (item != null) promise = promise.eq('item', item);
            if (limit != null) promise = promise.limit(limit);
            let { data: loot, error } = await promise;
            if (error) return end(500, JSON.stringify({ error: 'Error fetching user', details: error.message }));
            loot.map(a => {
                a.type = currency;
                return a;
            });
            allLoot.push(...loot);
        }
        allLoot.sort((a, b) => new Date(b.acquired_at).getTime() - new Date(a.acquired_at).getTime());
        if (limit != null) allLoot = allLoot.slice(0, limit);

        res.end(JSON.stringify(allLoot));
    }
}