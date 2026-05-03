import { config, supabase } from '../lib.js';

export default {
    name: 'events',
    description: 'Gets a list of events',
    options: [
        {
            name: 'active',
            description: 'Whether or not the event is active',
            accepts: ['true', 'false'],
            caseInsensitive: true
        },
        {
            name: 'monster',
            description: 'Which monster the event is for'
        }
    ],
    async execute({ res, url, end }) {
        let active = url.searchParams.get('active');
        let monster = url.searchParams.get('monster');

        let promise = supabase.from(config.supabase.tables.events).select('*');
        if (active != null) promise = promise.eq('active', active == 'true');
        if (monster != null) promise = promise.eq('monster_name', monster);
        let { data: events, error } = await promise;
        if (error) return end(500, JSON.stringify({ error: 'Error fetching events', details: error.message }));

        res.end(JSON.stringify(events));
    }
}