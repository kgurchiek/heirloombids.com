import { config, supabase } from '../lib.js';

export default {
    name: 'checkuser',
    description: 'Gets information about a user',
    options: [
        {
            name: 'id',
            description: 'the id of the user to get information about',
            required: true
        }
    ],
    async execute({ res, end, url }) {
        let id = url.searchParams.get('id');
        
        let { data: account, error } = await supabase.from(config.supabase.tables.users).select('*').eq('id', id).limit(1);
        if (error) return end(500, JSON.stringify({ error: 'Error fetching user', details: error.message }));
        account = account[0];
        if (error) return end(400, JSON.stringify({ error: `No registered user with id "${id}" could be found` }));

        res.end(JSON.stringify(account));
    }
}