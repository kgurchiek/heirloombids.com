import { config, supabase } from '../lib.js';

export default {
    name: 'wipe',
    description: 'Deletes all active signups from a roster',
    options: [
        {
            name: 'id',
            description: 'The id of the event',
            required: true
        }
    ],
    async execute({ res, end, url }) {
        let id = url.searchParams.get('id');

        let { data: event, error } = await supabase.from(config.supabase.tables.events).select('*').eq('event_id', id).limit(1);
        if (error) return end(500, { error: 'Error fetching event', details: error.message });
        event = event[0];
        if (event == null) return end(400, { error: `Couldn't find event with id "${id}"` });
        if (!event.active) return end(400, { error: 'Event closed' });

        let signups;
        ({ data: signups, error } = await supabase.from(config.supabase.tables.signups).delete().eq('event_id', id).eq('active', true).select('*'));
        if (error) return end(500, { error: 'Error deleting signups', details: error.message });
        res.end(JSON.stringify(signups));
    }
}