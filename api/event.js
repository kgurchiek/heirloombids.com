import { config, supabase } from '../lib.js';

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
    async execute({ res, url }) {
        let id = url.searchParams.get('id');
        let { data: event, error } = await supabase.from(config.supabase.tables.events).select('*').eq('event_id', id).limit(1);
        if (error) return end(500, JSON.stringify({ error: 'Error fetching event', details: error.message }));
        event = event[0];
        if (event == null) return end(400, JSON.stringify({ error: `No auctions found with id "${id}"` }));

        res.end(JSON.stringify(event));
    }
}