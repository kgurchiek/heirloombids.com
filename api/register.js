export default {
    name: 'register',
    description: 'Creates an account',
    options: [
        {
            name: 'username',
            description: 'your in-game username',
            required: true
        }
    ],
    async execute({ config, res, end, url, user, supabase }) {
        let username = url.searchParams.get('username');
        if ((await supabase.from(config.supabase.tables.users).select('*').eq('id', user.id).limit(1)).data[0] != null) return end(400, JSON.stringify({ error: 'Account already exists' }));
        if ((await supabase.from(config.supabase.tables.users).select('*').eq('username', username).limit(1)).data[0] != null) return end(400, JSON.stringify({ error: 'Username taken' }));

        let { data, error } = await supabase.from(config.supabase.tables.users).insert({ id: user.id, username: username, dkp: 0, ppp: 0, frozen: false }).select('*');
        if (error) return end(500, JSON.stringify({ error: 'Error registering user', details: error.message }));
        res.end(JSON.stringify(data[0]));
    }
}