import { config, supabase, supabaseCache } from '../lib.js';

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

        let items = supabaseCache[config.supabase.tables.items].filter(a => a.available);
        if (monster != null) items = items.filter(a => a.monster == monster);
        if (search != null) items = items.filter(a => a.name.toLowerCase().includes(search.toLowerCase()));

        res.end(JSON.stringify(items));
    }
}