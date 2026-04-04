import { config, supabase } from '../lib.js';

export default {
    name: 'pause',
    description: 'Pauses or unpauses a roster',
    options: [
        {
            name: 'id',
            description: 'The id of the event to pause',
            required: true
        },
        {
            name: 'paused',
            description: 'Wether or not the event should be paused (default: true)',
            accept: ['true', 'false'],
            caseInsensitive: true
        }
    ],
    async execute({ res, end, url }) {
        let id = url.searchParams.get('id');
        let paused = (url.searchParams.get('paused') || 'true') == 'true';
        
        let { data: event, error } = await supabase.from(config.supabase.tables.events).select('*').eq('event_id', id).limit(1);
        if (error) return end(500, JSON.stringify({ error: 'Error fetching event', details: error.message }));
        event = event[0];
        if (event == null) return end(400, JSON.stringify({ error: `Couldn't find event with id "${id}"` }));
        if (!event.active) return end(400, JSON.stringify({ error: 'Event closed' }));

        if (event.paused == paused) return res.end(JSON.stringify(event));

        ({ data: event, error } = await supabase.from(config.supabase.tables.events).update({ paused }).eq('event_id', id).select('*'));
        if (error) return end(500, JSON.stringify({ error: 'Error updating event', details: error.message }));
        res.end(JSON.stringify(event[0]));
    }
}