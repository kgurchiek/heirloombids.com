export default {
    name: 'auction',
    description: 'Gets information about an open auction',
    options: [
        {
            name: 'id',
            description: 'the id of the auction to get information about',
            required: true
        }
    ],
    async execute({ config, res, url, supabase }) {
        let id = url.searchParams.get('id');
        let { data: auction, error } = await supabase.from(config.supabase.tables.auctions).select('*').eq('id', id).limit(1);
        if (error) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: 'Error fetching auctions', details: error.message }));
            return;
        }
        auction = auction[0];
        if (auction == null) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: `No auctions found with id "${id}"` }));
            return;
        }

        res.end(JSON.stringify(auction));
    }
};