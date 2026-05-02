import { config, supabase } from '../lib.js';

export default {
    name: 'items',
    description: 'Gets a list of items',
    options: [
        {
            name: 'monster',
            description: 'The monster the item is from'
        },
        {
            name: 'search',
            description: 'Text to search for in item name'
        }
    ],
    async execute({ res, end, url }) {
        let monster = url.searchParams.get('monster');
        let search = url.searchParams.get('search');

        let promise = supabase.from(config.supabase.tables.items).select('*').eq('available', true);
        if (monster != null) promise = promise.eq('monster', monster);
        if (search != null) promise = promise.like('name', `%${search}%`);

        let { data: items, error } = await promise;
        if (error) return end(500, JSON.stringify({ error: 'Error fetching items', details: error.message }));

        res.end(JSON.stringify(items));
    }
}