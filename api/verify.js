import { config, supabase, calculateBonusPoints } from '../lib.js';

export default {
    name: 'verify',
    description: 'Verifies an event signup',
    options: [
        {
            name: 'id',
            description: 'The id of the signup',
            required: true
        },
        {
            name: 'verified',
            description: 'Whether or not to mark the signup as verified',
            accepts: ['true', 'false'],
            caseInsensitive: true
        }
    ],
    async execute({ res, end, url, user }) {
        let id = url.searchParams.get('id');
        let verified = url.searchParams.get('verified') == 'true';

        if (!user.staff) return end(403, { error: 'Staff Only', details: 'Only staff can verify signups' });
        
        let { data: signup, error } = await supabase.from(config.supabase.tables.signups).update({ verified }).eq('signup_id', id).select('*, event_id (*, monster_name (*))');
        if (error) return end(500, { error: 'Error verifying signup', details: error.message });
        if (signup.length == 0) return end(400, { error: `Couldn't find signup with id "${id}"` });
        signup = signup[0];
        
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
        
        res.end(JSON.stringify(signup));
    }
}