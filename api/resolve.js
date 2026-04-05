import { config, supabase, calculateCampPoints, calculateBonusPoints } from '../lib.js';

export default {
    name: 'resolve',
    description: 'Resolves a roster event',
    options: [
        {
            name: 'id',
            description: 'The id of the event',
            required: true
        }
    ],
    async execute({ res, end, url, user }) {
        let id = url.searchParams.get('id');

        if (!user.staff) return end(403, { error: 'Only staff can resolve an event' });

        let { data: event, error } = await supabase.from(config.supabase.tables.events).select('*').eq('event_id', id).limit(1);
        if (error) return end(500, { error: 'Error Fetching Event', details: error.message });
        event = event[0];
        if (event == null) return end(400, { error: `Couldn't find event with id "${id}"` });
        if (event.verified) return end(400, { error: 'Event already verified' });

        let signups;
        ({ data: signups, error } = await supabase.from(config.supabase.tables.signups).select('*').eq('event_id', id));
        if (error) return end(500, { error: 'Error Fetching Signups', details: error.message });

        signups.forEach(async (signup, i, arr) => {
            if (arr.slice(0, i).find(a => a.player_id.id == signup.player_id.id) == null) {
                let { error } = await supabase.from(config.supabase.tables.users).update({ last_camped: new Date() }).eq('id', signup.player_id.id);
                if (error) return end(500, { error: 'Error updating last camp', details: error.message });
            }
            
            let points = { DKP: 0, PPP: 0 };
            let campPoints;
            try {
                campPoints = calculateCampPoints(monster.monster_name, signup.windows, event.windows);
            } catch (err) {
                return end(500, { error: 'Error calculating camp points', details: err.message });
            }
            points[campPoints.type] += campPoints.points;
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
                ({ error } = await supabase.rpc('increment_points', { table_name: config.supabase.tables.users, id: signup.player_id.id, type: 'dkp', amount: points.DKP }));
                if (error) return await interaction.editReply({ ephemeral: true, embeds: [errorEmbed('Error incrementing dkp', error.message)] });
                ({ error } = await supabase.rpc('increment_points', { table_name: config.supabase.tables.users, id: signup.player_id.id, type: 'lifetime_dkp', amount: points.DKP }));
                if (error) return await interaction.editReply({ ephemeral: true, embeds: [errorEmbed('Error incrementing lifetime dkp', error.message)] });
            }
            if (points.PPP != 0) {
                ({ error } = await supabase.rpc('increment_points', { table_name: config.supabase.tables.users, id: signup.player_id.id, type: 'ppp', amount: points.PPP }));
                if (error) return await interaction.editReply({ ephemeral: true, embeds: [errorEmbed('Error incrementing ppp', error.message)] });
                ({ error } = await supabase.rpc('increment_points', { table_name: config.supabase.tables.users, id: signup.player_id.id, type: 'lifetime_ppp', amount: points.PPP }));
                if (error) return await interaction.editReply({ ephemeral: true, embeds: [errorEmbed('Error incrementing lifetime ppp', error.message)] });
            }
        });

        
        ({ data: event, error } = await supabase.from(config.supabase.tables.events).update({ verified: true }).eq('event_id', id).select('*'));
        if (error) return end(500, { error: 'Error updating event', details: error.message });

        res.end(JSON.stringify(event[0]));
    }
}