export default {
    name: 'auctions',
    description: 'Gets a list of auctions',
    options: [
        {
            name: 'open',
            description: 'whether or not the auction is open',
            accepts: ['true', 'false', null],
            caseInsensitive: true
        }
    ],
    async execute({ config, res, end, url, supabase }) {
        let open = url.searchParams.get('open');
        let auctions;
        let error;
        if (open == null) ({ data: auctions, error } = await supabase.from(config.supabase.tables.auctions).select('*'));
        else ({ data: auctions, error } = await supabase.from(config.supabase.tables.auctions).select('*').eq('open', open));
        if (error) return end(500, JSON.stringify({ error: 'Error fetching auctions', details: error.message }));

        res.end(JSON.stringify(auctions));
    }
}