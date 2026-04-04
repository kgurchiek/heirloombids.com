import { config, supabase } from '../lib.js';

export default {
    name: 'create-roster',
    description: 'Opens a roster for a user',
    options: [
        {
            name: 'monster',
            description: 'The monster to open a roster for',
            required: true
        },
        {
            name: 'rage',
            description: 'Whether or not it\'s a rage roster',
            accept: ['true', 'false'],
            caseInsensitive: true
        }
    ],
    async execute({ res, end, url }) {
        let monster = url.searchParams.get('monster');
        let rage = url.searchParams.get('rage') == 'true';

        let { data: event, error } = await supabase.from(config.supabase.tables.events).select('*').eq('monster_name', monster).eq('active', true).limit(1);
        if (error) return end(500, JSON.stringify({ error: 'Error Fetching Event', details: error.message }));
        event = event[0];

        if (event == null) {
            let { data: lastEvent, error } = await supabase.from(config.supabase.tables.events).select('*').eq('monster_name', monster);
            if (error) return end(500, JSON.stringify({ error: 'Error Fetching Past Events', details: error.message }));
            lastEvent = lastEvent.sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime())[0];
            let timestamp = lastEvent == null ? Math.floor(Date.now() / 1000) + 60 * 60 : Math.floor(new Date(lastEvent.start_time).getTime() / 1000);
            let day = lastEvent?.day || 0;
            ({ data: event, error } = await supabase.from(config.supabase.tables.events).insert({
                monster_name: monster,
                start_time: new Date(timestamp * 1000),
                day,
                rage
            }).select('*'));
            if (error) return end(500, JSON.stringify({ error: `Error creating event for ${monster}`, details: error.message }));

            res.end(JSON.stringify(event[0]));
        } else {
            if (!rage) return end(400, JSON.stringify({ error: `A roster for ${monster} is already open` }));
            if (event.rage) return end(400, JSON.stringify({ error: 'Roster is already in rage mode' }));

            let { data, error } = await supabase.from(config.supabase.tables.events).update({ rage }).eq('event_id', event.event_id).select('*');
            if (error) return end(500, JSON.stringify({ error: `Error updating ${monster} rage status`, details: error.message }));

            res.end(JSON.stringify(data[0]));
        }
    }
}