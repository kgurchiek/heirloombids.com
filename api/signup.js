import { config, supabase } from '../lib.js';

export default {
    name: 'signup',
    description: 'Gets information about a roster signup',
    options: [
        {
            name: 'id',
            description: 'The id of the signup',
            required: true
        }
    ],
    async execute({ res, end, url }) {
        let id = url.searchParams.get('id');
        
        let { data: signup, error } = await supabase.from(config.supabase.tables.signups).select('*').eq('signup_id', id).limit(1);
        if (error) return end(500, { error: 'Error fetching signup', details: error.message });
        signup = signup[0];
        if (signup == null) return end(400, { error: `Couldn't find signup with id "${id}"` });

        res.end(JSON.stringify(signup));
    }
}