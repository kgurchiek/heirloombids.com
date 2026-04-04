import { config, supabase } from '../lib.js';

export default {
    name: 'populate',
    description: 'Populates a roster',
    options: [
        {
            name: 'id',
            description: 'The id of the roster',
            required: true
        },
        {
            name: 'group',
            description: 'The group that killed the monster',
            required: true
        },
        {
            name: 'zone',
            description: 'How many tags were in zone',
            required: true
        },
        {
            name: 'windows',
            description: 'How many windows the roster was open for'
        },
        {
            name: 'monster',
            description: 'Which monster spawned'
        }
    ],
    async execute({ res, end, url }) {
        let id = url.searchParams.get('id');
        let group = url.searchParams.get('group');
        let zone = url.searchParams.get('zone');
        let windows = url.searchParams.get('windows');
        let monster = url.searchParams.get('monster');
        
        if (isNaN(parseInt(zone))) return end(400, { error: 'Invalid value for arg "zone"', details: `"${zone}" is not a number` });

        let { data: event, error } = await supabase.from(config.supabase.tables.events).select('*').eq('event_id', id);
        if (error) return end(500, { error: 'Error Fetching Event', details: error.message });
        event = event[0];
        if (event == null) return end(400, { error: `Couldn't find event with id "${id}"` });
        if (!event.active) return end(400, { error: 'Event closed' });
        
        if (!event.rage && monster != 'Tiamat' && !config.roster.placeholderMonsters.includes(event.monster_name)) {
            if (windows == null) return end(400, { error: 'Missing required arg "windows"' });
            if (isNaN(parseInt(windows))) return end(400, { error: 'Invalid value for arg "windows"', details: `"${windows}" is not a number` });
            windows = parseInt(windows);
        }

        ({ data: event, error } = await supabase.from(config.supabase.tables.events).update({
            monster_name: monster || event.monster_name,
            windows,
            killed_by: group,
            zone,
            active: false
        }).eq('event_id', id).select('*'));
        if (error) return end(500, { error: 'Error Updating Event', details: error.message });
        res.end(JSON.stringify(event[0]));
    }
}