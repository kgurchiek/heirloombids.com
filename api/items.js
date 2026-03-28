export default {
    name: 'items',
    description: 'Gets a list of items',
    async execute({ config, res, end, supabase }) {
        let { data: items, error } = await supabase.from(config.supabase.tables.items).select('*').eq('available', true);
        if (error) end(500, JSON.stringify({ error: 'Error fetching auctions', details: error.message }));

        res.end(JSON.stringify(items));
    }
}