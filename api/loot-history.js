import { config, supabase } from '../lib.js';

export default {
    name: 'loot-history',
    description: 'Gets loot history of an item',
    options: [
        {
            name: 'item',
            description: 'The name of the item to get loot history of',
            required: true
        }
    ],
    async execute({ res, url, end }) {
        let itemName = url.searchParams.get('item');
        let { data: item, error } = await supabase.from(config.supabase.tables.items).select('*').eq('name', itemName);
        if (error) return end(500, JSON.stringify({ error: 'Error fetching item', details: error.message }));
        item = item[0];
        if (item == null) return end(500, JSON.stringify({ error: `Unkown item "${itemName}"` }));

        let lootHistory;
        ({ data: lootHistory, error } = await supabase.from(config.supabase.tables[item.type].lootHistory).select('*').eq('item', item.name));
        if (error) return end(500, JSON.stringify({ error: 'Error fetching loot history', details: error.message }));
        
        res.end(JSON.stringify(lootHistory));
    }
}