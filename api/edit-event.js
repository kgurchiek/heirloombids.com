import { config, supabase, supabaseCache } from '../lib.js';

export default {
    name: 'edit-event',
    description: 'Edit a roster event',
    options: [
        {
            name: 'id',
            description: 'The id of the event to edit',
            required: true
        },
        {
            name: 'update',
            description: 'JSON of new data to update',
            required: true
        }
    ],
    async execute({ res, end, url, user }) {
        let id = url.searchParams.get('id');
        let edit;
        try {
            edit = JSON.parse(url.searchParams.get('update'));
        } catch (err) {
            return end(400, { error: 'Error parsing arg "event"', details: err.message });
        }

        let keys = Object.keys(edit);
        if (!user.staff) for (let key of keys) if (!config.roster.eventEdits.includes(key)) return end(403, { error: 'Staff Only', details: `Only staff can edit column "${key}"` });
        
        let { data: event, error } = await supabase.from(config.supabase.tables.events).select('*').eq('event_id', id).limit(1);
        if (error) return end(500, { error: 'Error fetching event', details: error.message });
        event = event[0];
        if (event == null) return end(400, { error: `Couldn't find event with id "${id}"` });
        if (!event.active) return end(400, { error: 'Event closed' });
        if (event.verified) return end(400, { error: 'Event has already been verified' });

        ({ data: event, error } = await supabase.from(config.supabase.tables.events).update(edit).eq('event_id', id).select('*'));
        if (error) return end(500, { error: 'Error updating event', details: error.message });
        res.end(JSON.stringify(event[0]));
    }
}