export default {
    name: 'event',
    description: 'Gets information about an event',
    options: [
        {
            name: 'id',
            description: 'the id of the event to get information about',
            required: true
        }
    ],
    async execute({ config, res, url, supabase }) {
        let id = url.searchParams.get('id');
        let { data: event, error } = await supabase.from(config.supabase.tables.events).select('*').eq('event_id', id).limit(1);
        if (error) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: 'Error fetching event', details: error.message }));
            return;
        }
        event = event[0];
        if (event == null) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: `No auctions found with id "${id}"` }));
            return;
        }

        res.end(JSON.stringify(event));
    }
}