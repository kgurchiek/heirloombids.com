import { config, supabase, supabaseCache } from '../lib.js';

export default {
    name: 'users',
    description: 'Gets information about all users',
     options: [
        {
            name: 'search',
            description: 'Text to search for in username'
        }
    ],
    async execute({ res, end, url }) {
        let search = url.searchParams.get('search');

        let users = supabaseCache[config.supabase.tables.users];
        if (search != null) users = users.filter(a => a.username.toLowerCase().includes(search.toLowerCase()));

        res.end(JSON.stringify(users));
    }
}