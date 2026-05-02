import { config, supabase } from '../lib.js';

export default {
    name: 'freeze',
    description: 'Freezes or unfreezes a user',
    options: [
        {
            name: 'id',
            description: 'The id of the user to get information about'
        },
        {
            name: 'frozen',
            description: 'Whether or not to set the user as frozen (defaults to true)',
            accepts: ['true', 'false', null],
            caseInsensitive: true
        }
    ],
    async execute({ res, end, url, user, guild }) {
        let id = url.searchParams.get('id');
        let frozen = (url.searchParams.get('frozen') || 'true').toLowerCase() == 'true';

        if (!user.staff) return end(403, { error: 'Staff Only', details: 'Only staff can freeze or unfreeze users' });
        
        let { data: account, error } = await supabase.from(config.supabase.tables.users).update({ frozen }).select('*').eq('id', id);
        if (error) return end(500, JSON.stringify({ error: 'Error updating user', details: error.message }));
        account = account[0];
        if (account == null) return end(400, JSON.stringify({ error: `No registered user with id "${id}" could be found` }));
        
        res.end(JSON.stringify(account));
    }
}