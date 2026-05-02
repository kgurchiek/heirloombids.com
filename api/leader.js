import { config, supabase } from '../lib.js';

export default {
    name: 'leader',
    description: 'Sets the leader of an event roster',
    options: [
        {
            name: 'id',
            description: 'The id of the event',
            required: true
        },
        {
            name: 'user',
            description: 'The id of the user to promote to leader'
        },
        {
            name: 'leader',
            description: 'Whether or not to promote to leader',
            accepts: ['true', 'false'],
            caseInsensitive: true
        }
    ],
    async execute({ res, end, url, user }) {
        let id = url.searchParams.get('id');
        let userId = url.searchParams.get('user') || user.id;
        let leader = (url.searchParams.get('leader') || 'true') == 'true';

        if (!(user.staff || userId == user.id)) return end(403, { error: 'Staff Only', details: 'Only staff can promote another user to leader' });

        let { data: event, error } = await supabase.from(config.supabase.tables.events).select('*').eq('event_id', id);
        if (error) return end(500, { error: 'Error fetching event', details: error.message });
        event = event[0];
        if (event == null) return end(400, { error: `Couldn't find event with id "${id}"` });

        let signup;
        ({ data: signup, error } = await supabase.from(config.supabase.tables.signups).select('*, slot_template_id (alliance_number, party_number)').eq('active', true).eq('event_id', id).eq('player_id', userId).limit(1));
        if (error) return end(500, { error: 'Error fetching signup', details: error.message });
        signup = signup[0];
        if (signup == null) return end(400, { error: `Couldn't find active signup for user with id "${userId}"` });

        if (leader) {
            let signups;
            ({ data: signups, error } = await supabase.from(config.supabase.tables.signups).select('*, slot_template_id!inner(alliance_number, party_number)')
                .eq('active', true)
                .eq('event_id', id)
                .eq('leader', true)
                .eq('slot_template_id.alliance_number', signup.slot_template_id.alliance_number)
                .eq('slot_template_id.party_number', signup.slot_template_id.party_number).limit(1));
            if (error) return end(500, { error: 'Error fetching signups', details: error.message });
            if (signups.length > 0) return end(400, { error: 'Party already has a leader' });
        }

        ({ data: signup, error } = await supabase.from(config.supabase.tables.signups).update({ leader }).eq('signup_id', signup.signup_id).select('*'));
        if (error) return end(500, { error: 'Error updating signup', details: error.message });

        res.end(JSON.stringify(signup[0]));
    }
}