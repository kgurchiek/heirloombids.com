export default {
    name: 'auction',
    description: 'Gets information about an auction',
    options: [
        {
            name: 'id',
            description: 'the id of the auction to get information about',
            required: true
        }
    ],
    async execute({ config, res, end, url, supabase }) {
        let id = url.searchParams.get('id');
        let { data: auction, error } = await supabase.from(config.supabase.tables.auctions).select('*').eq('id', id).limit(1);
        if (error) return end(500, JSON.stringify({ error: 'Error fetching auction', details: error.message }));
        auction = auction[0];
        if (auction == null) return end(400, JSON.stringify({ error: `No auctions found with id "${id}"` }));

        res.end(JSON.stringify(auction));
    }
}