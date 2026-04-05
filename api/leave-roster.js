import { config, supabase } from '../lib.js';

export default {
    name: 'leave-roster',
    description: 'Removes a roster signup',
    options: [
        {
            name: 'id',
            description: 'The id of the signup',
            required: true
        },
        {
            name: 'windows',
            description: 'How many windows the user participated in'
        }
    ],
    async execute({ res, end, url, user }) {
        let id = url.searchParams.get('id');
        let windows = url.searchParams.get('id');

        if (windows == null && !(monster == 'Tiamat' || config.roster.placeholderMonsters.includes(monster))) return end(400, { error: 'Missing required arg "windows"' })
        
        let { data: signup, error } = await supabase.from(config.supabase.tables.signups).select('*').eq('signup_id', id).limit(1);
        if (error) return end(500, { error: 'Error fetching signup', details: error.message });
        signup = signup[0];
        if (signup == null) return end(400, { error: `Couldn't find signup with id "${id}"` });

        if (!(user.staff || signup.player_id == user.id)) return end(403, { error: 'Only staff can remove another user\'s signup' });
        
        if (windows == null) {
            ({ data: signup, error } = await supabase.from(config.supabase.tables.signups).delete().eq('signup_id', id).select('*'));
            if (error) return end(500, { error: 'Error deleting signup', details: error.message });
        } else {
            ({ data: signup, error } = await supabase.from(config.supabase.tables.signups).update({ active: false, windows }).eq('signup_id', id).select('*'));
            if (error) return end(500, { error: 'Error updating signup', details: error.message });
        }

        res.end(JSON.stringify(signup[0]));
    }
}