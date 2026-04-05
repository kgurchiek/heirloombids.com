import { config, supabase } from '../lib.js';

export default {
    name: 'todgrab',
    description: 'Sets todgrab for an event roster',
    options: [
        {
            name: 'id',
            description: 'The id of the event',
            required: true
        },
        {
            name: 'user',
            description: 'The id of the user to set as todgrab'
        }
    ],
    async execute({ res, end, url, user }) {
        let id = url.searchParams.get('id');
        let userId = url.searchParams.get('user');

        if (userId != null && userId != user.id) {
            if (!user.staff) return end(403, { error: 'Only staff can set another user as todgrab' });

            let { data, error } = await supabase.from(config.supabase.tables.users).select('*').eq('id', userId);
            if (error) return end(500, { error: 'Error fetching user', details: error.message });
            if (data.length == 0) return end(400, { error: `Couldn't find user with id "${userId}"` });
        }

        let { data: event, error } = await supabase.from(config.supabase.tables.events).update({ todgrab: userId }).eq('event_id', id).select('*');
        if (error) return end(500, { error: 'Error updating event', details: error.message });
        event = event[0];
        if (event == null) return end(400, { error: `Couldn't find event with id "${id}"` });

        res.end(JSON.stringify(event));
    }
}