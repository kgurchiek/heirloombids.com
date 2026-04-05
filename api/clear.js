import { config, supabase } from '../lib.js';

export default {
    name: 'clear',
    description: 'Clears active signups on an event and progresses to the next window',
    options: [
        {
            name: 'id',
            description: 'The id of the event',
            required: true
        }
    ],
    async execute({ res, end, url }) {
        let id = url.searchParams.get('id');

        let { data: event, error } = await supabase.from(config.supabase.tables.events).select('*').eq('event_id', id);
        if (error) return end(500, { error: 'Error fetching event', details: error.message });
        event = event[0];
        if (event == null) return end(400, { error: `Couldn't find event with id "${id}"` });

        ({ error } = await supabase.from(config.supabase.tables.signups).update({ active: false }).eq('event_id', id).eq('active', true));
        if (error) return end(500, { error: 'Error closing signups', details: error.message });

        event.windows = (event.windows || 0) + 1;
        ({ error } = await supabase.from(config.supabase.tables.events).update({ windows: event.windows }).eq('event_id', id).eq('active', true));
        if (error) return end(500, { error: 'Error updating windows', details: error.message });

        let signups;
        ({ data: signups, error } = await supabase.from(config.supabase.tables.signups).update({ active: true }).eq('event_id', id).eq('window', event.windows).select('*'));
        if (error) return end(500, { error: 'Error closing signups', details: error.message });

        res.end(JSON.stringify(signups));
    }
}