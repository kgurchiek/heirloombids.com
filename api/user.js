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
    async execute({ config, res, url, supabase }) {
        let id = url.searchParams.get('id');
        
        let { data: account, error } = await supabase.from(config.supabase.tables.users).select('*').eq('id', id).limit(1);
        if (error) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: 'Error fetching user', details: error.message }));
            return;
        }
        account = account[0];
        if (error) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: `No registered user with id "${id}" could be found` }));
            return;
        }

        res.end(JSON.stringify(account));
    }
}