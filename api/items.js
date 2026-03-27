export default {
    name: 'items',
    description: 'Gets a list of items',
    async execute({ config, res, supabase }) {
        let { data: items, error } = await supabase.from(config.supabase.tables.items).select('*').eq('available', true);
        if (error) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: 'Error fetching auctions', details: error.message }));
            return;
        }

        res.end(JSON.stringify(items));
    }
}