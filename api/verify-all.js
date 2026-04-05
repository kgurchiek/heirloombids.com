import { config, supabase } from '../lib.js';

export default {
    name: 'verify-all',
    description: 'Verifies all signups in an event',
    options: [
        {
            name: 'id',
            description: 'The id of the event',
            required: true
        }
    ],
    async execute({ res, end, url, user }) {
        let id = url.searchParams.get('id');

        if (!user.staff) return end(403, { error: 'Only staff can verify signups' });

        let { data: event, error } = await supabase.from(config.supabase.tables.events).select('*').eq('event_id', id).limit(1);
        if (error) return end(500, { error: 'Error fetching event', details: error.message });
        event = event[0];
        if (event == null) return end(400, { error: `Couldn't find event with id "${id}"` });

        let signups;
        ({ data: signups, error } = await supabase.from(config.supabase.tables.signups).update({ verified: true }).eq('event_id', id).select('*'));
        if (error) return end(500, { error: 'Error verifying signups', details: error.message });
        res.end(JSON.stringify(signups));
    }
}