import { config, supabase, calculateCampPoints, calculateBonusPoints } from '../lib.js';

export default {
    name: 'reward-details',
    description: 'Gets details of an event\'s rewards',
    options: [
        {
            name: 'id',
            description: 'The id of the event to get details of',
            required: true
        }
    ],
    async execute({ res, url, end }) {
        let id = url.searchParams.get('id');

        let { data: event, error } = await supabase.from(config.supabase.tables.events).select('*').eq('event_id', id);
        if (error) return end(500, JSON.stringify({ error: 'Error Fetching Event', details: error.message }));
        event = event[0];
        if (event == null) return end(400, JSON.stringify({ error: `Couldn't find event with id "${id}"` }));

        let monster;
        ({ data: monster, error } = await supabase.from(config.supabase.tables.monsters).select('*').eq('monster_name', event.monster_name));
        if (error) return end(500, JSON.stringify({ error: 'Error Fetching Monster', details: error.message }));
        monster = monster[0];
        if (monster == null) return end(500, JSON.stringify({ error: 'Error Fetching Monster', details: `Couldn't find monster with name "${event.monster_name}"` }));

        let signups;
        ({ data: signups, error } = await supabase.from(config.supabase.tables.signups).select('*, player_id (id, username)').eq('event_id', id));
        if (error) return end(500, JSON.stringify({ error: 'Error Fetching Signups', details: error.message }));

        let campRules;
        ({ data: campRules, error } = await supabase.from(config.supabase.tables.campRules).select('*'));
        if (error) return end(500, JSON.stringify({ error: 'Error Fetching Signups', details: error.message }));
        
        let pointRules;
        ({ data: pointRules, error } = await supabase.from(config.supabase.tables.pointRules).select('*'));
        if (error) return end(500, JSON.stringify({ error: 'Error Fetching Signups', details: error.message }));

        signups = signups.map((a, i, arr) => {
            if (arr.slice(0, i).find(b => b.player_id.id == a.player_id.id) != null) return;
            a.windows = arr.filter(b => b.player_id.id == a.player_id.id).reduce((b, c) => b + c.windows || 0, 0);
            return a;
        }).filter(a => a != null);
        for (let signup of signups) {
            let points = { DKP: 0, PPP: 0 };
            let campRule = campRules.find(b => b.monster_name == monster.monster_name);
            if (campRule == null) return end(500, JSON.stringify({ error: 'Error fetching point rule', details: `Couldn't find camp point rule for monster ${monster.monster_name}` }));
            points[campRule.type] += calculateCampPoints(campRules, monster.monster_name, signup.windows, event.windows);
            let type = monster.monster_type;
            if (type == 'NQ' && event.day >= 4) type = 'HQ';
            let bonusRule = pointRules.find(b => b.monster_type == type);
            points[bonusRule.dkp_value ? 'DKP' : 'PPP'] += calculateBonusPoints(pointRules, signup, type);
            signup.points = points;
        }
        res.end(JSON.stringify(signups));
    }
}