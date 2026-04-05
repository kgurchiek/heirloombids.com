import { config, supabase } from '../lib.js';

export default {
    name: 'signups',
    description: 'Gets a list of signups for an event',
    options: [
        {
            name: 'id',
            description: 'The id of the event',
            required: true
        }
    ],
    async execute({ res, end, url }) {
        let id = url.searchParams.get('id');

        let { data: signups, error } = await supabase.from(config.supabase.tables.signups).select('*').eq('event_id', id);
        if (error) return end(500, { error: 'Error fetching signups', details: error.message });

        res.end(JSON.stringify(signups));
    }
}