import { config, supabase } from '../lib.js';

export default {
    name: 'attendance',
    description: 'Marks a user\'s roster attendance',
    options: [
        {
            name: 'id',
            description: 'The id of the event',
            required: true
        },
        {
            name: 'tagged',
            description: 'Whether or not you tagged the monster',
            required: true,
            accepts: ['true', 'false'],
            caseInsensitive: true
        },
        {
            name: 'killed',
            description: 'Whether or not you killed the monster`',
            required: true,
            accepts: ['true', 'false'],
            caseInsensitive: true
        },
        {
            name: 'windows',
            description: 'How many windows you attended'
        },
        {
            name: 'user',
            description: 'The id of the user to mark attendance for'
        }
    ],
    async execute({ res, end, url, user }) {
        let id = url.searchParams.get('id');
        let tagged = url.searchParams.get('tagged') == 'true';
        let killed = url.searchParams.get('killed') == 'true';
        let windows = url.searchParams.get('windows');
        if (windows != null) {
            if (isNaN(parseInt(windows))) return end(400, JSON.stringify({ error: 'Invalid value for arg "windows"', details: `"${windows}" is not a number` }));
            windows = parseInt(windows);
        }
        let userId = url.searchParams.get('user');
        if (user.staff == false && userId != null) return end(403, { error: 'Staff Only', details: `Only staff can mark attendance for other users` });
        if (userId == null) userId = user.id

        let { data: signup, error } = await supabase.from(config.supabase.tables.signups).select('signup_id').eq('event_id', id);
        if (error) return end(500, JSON.stringify({ error: 'Error fetching signup', details: error.message }));
        if (signup.length == 0) return end(500, JSON.stringify({ error: `Couldn't find a signup for user "${userId}" for event "${id}"` }));
        signup = signup[0];

        ({ data: signup, error } = await supabase.from(config.supabase.tables.signups).update({
            tagged,
            killed,
            windows
        }).eq('signup_id', signup.signup_id).select('*'));
        if (error) return end(500, JSON.stringify({ error: 'Error updating signup', details: error.message }));
        if (signup.length == 0) return end(500, JSON.stringify({ error: `Couldn't find signup with id "${signup_id}"` }));

        res.end(JSON.stringify(signup[0]));
    }
}