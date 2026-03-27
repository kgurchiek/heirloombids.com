export default {
    name: 'events',
    description: 'Gets a list of events',
    options: [
        {
            name: 'active',
            description: 'whether or not the event is active',
            accepts: ['true', 'false', null],
            caseInsensitive: true
        }
    ],
    async execute({ config, res, url, supabase }) {
        let active = url.searchParams.get('active');
        let events;
        let error;
        if (active == null) ({ data: events, error } = await supabase.from(config.supabase.tables.events).select('*'));
        else ({ data: events, error } = await supabase.from(config.supabase.tables.events).select('*').eq('active', active));
        if (error) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: 'Error fetching events', details: error.message }));
            return;
        }

        res.end(JSON.stringify(events));
    }
}