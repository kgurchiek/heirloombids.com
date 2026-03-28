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
        // if ((await supabase.from(config.supabase.tables.users).select('*').eq('id', user.id).limit(1)).data[0] != null) return end(400, JSON.stringify({ error: 'Account already exists' }));
        if ((await supabase.from(config.supabase.tables.users).select('*').eq('username', username).limit(1)).data[0] != null) return end(400, JSON.stringify({ error: 'Username taken' }));

        let error;
        try {
            let response = await supabase.from(config.supabase.tables.users).insert({ id: 0, username: username, dkp: 0, ppp: 0, frozen: false }).select('*');
            console.log(response)
            
            if (response.error) error = response.error;
            else res.end(JSON.stringify(response.data[0]));
        } catch (err) { error = err; }
        if (error) return end(500, JSON.stringify({ error: 'Error registering user', details: error.message }));
    }
}