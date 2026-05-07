import { config, supabase } from '../lib.js';

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

        let signup;
        ({ data: signup, error } = await supabase.from(config.supabase.tables.signups).update({ verified }).eq('signup_id', id).select('*'));
        if (error) return end(500, { error: 'Error verifying signup', details: error.message });
        if (signup.length == 0) return end(400, { error: `Couldn't find signup with id "${id}"` });
        res.end(JSON.stringify(signup[0]));
    }
}