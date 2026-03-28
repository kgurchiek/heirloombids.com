export default {
    name: 'unregister',
    description: 'Deletes an account',
    async execute({ config, res, end, user, supabase }) {
        if ((await supabase.from(config.supabase.tables.users).select('*').eq('id', user.id).limit(1)).data[0] == null) return end(400, JSON.stringify({ error: 'Account not found' }));

        let { data, error } = await supabase.from(config.supabase.tables.users).delete().eq('id', user.id).select('*');
        console.log(response);
        if (error) return end(500, JSON.stringify({ error: 'Error registering user', details: error.message }));
        res.end(JSON.stringify(data[0]));
    }
}