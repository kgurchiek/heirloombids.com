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

        if (!user.staff) return end(403, { error: 'Staff Only', details: 'Only staff can verify signups' });

        let { data: event, error } = await supabase.from(config.supabase.tables.events).select('*').eq('event_id', id).limit(1);
        if (error) return end(500, { error: 'Error fetching event', details: error.message });
        event = event[0];
        if (event == null) return end(400, { error: `Couldn't find event with id "${id}"` });

        let signups;
        ({ data: signups, error } = await supabase.from(config.supabase.tables.signups).update({ verified: true }).eq('event_id', id).eq('verified', null).select('*, event_id (*, monster_name (*))'));
        if (error) return end(500, { error: 'Error verifying signups', details: error.message });

        for (let signup of signups) {
            let event = signup.event_id;
            let monster = event.monster_name;
            ({ error } = await supabase.from(config.supabase.tables.tags).insert({ player_id: signup.player_id, monster_name: monster.monster_name }));
            if (error) return end(500, { error: 'Error inserting tag', details: error.message });
            
            let points = { DKP: 0, PPP: 0 };
            let type = monster.monster_type;
            if (type == 'NQ' && event.day >= 4) type = 'HQ';
            let bonusPoints;
            try {
                bonusPoints = calculateBonusPoints(signup, type);
            } catch (err) {
                return end(500, { error: 'Error calculating bonus points', details: err.message });
            }
            points[bonusPoints.type] += bonusPoints.points;

            if (points.DKP != 0) {
                ({ error } = await supabase.rpc('increment_points', { table_name: config.supabase.tables.users, id: signup.player_id, type: 'dkp', amount: points.DKP }));
                if (error) return await interaction.editReply({ ephemeral: true, embeds: [errorEmbed('Error incrementing dkp', error.message)] });
                ({ error } = await supabase.rpc('increment_points', { table_name: config.supabase.tables.users, id: signup.player_id, type: 'lifetime_dkp', amount: points.DKP }));
                if (error) return await interaction.editReply({ ephemeral: true, embeds: [errorEmbed('Error incrementing lifetime dkp', error.message)] });
            }
            if (points.PPP != 0) {
                ({ error } = await supabase.rpc('increment_points', { table_name: config.supabase.tables.users, id: signup.player_id, type: 'ppp', amount: points.PPP }));
                if (error) return await interaction.editReply({ ephemeral: true, embeds: [errorEmbed('Error incrementing ppp', error.message)] });
                ({ error } = await supabase.rpc('increment_points', { table_name: config.supabase.tables.users, id: signup.player_id, type: 'lifetime_ppp', amount: points.PPP }));
                if (error) return await interaction.editReply({ ephemeral: true, embeds: [errorEmbed('Error incrementing lifetime ppp', error.message)] });
            }

            signup.event_id = event.event_id;
        }

        res.end(JSON.stringify(signups));
    }
}