import { config, supabase } from '../lib.js';

export default {
    name: 'user',
    description: 'Gets information about a user',
    options: [
        {
            name: 'id',
            description: 'The id of the user to get information about'
        }
    ],
    async execute({ res, end, url, user, guild }) {
        let id = url.searchParams.get('id');
        
        let { data: account, error } = await supabase.from(config.supabase.tables.users).select('*').eq('id', id).limit(1);
        if (error) return end(500, JSON.stringify({ error: 'Error fetching user', details: error.message }));
        account = account[0];
        if (account == null) return end(400, JSON.stringify({ error: `No registered user with id "${id}" could be found` }));
        
        if (config.discord.registerBypass.includes(id)) account.staff = false;
        else {
            try {
                guildMember = await guild.members.fetch(id);
            } catch (err) {
                return end(403, { error: `No registered user with id "${id}" could be found in the Discord server` });
            }

            account.staff = false;
            for (const role of config.discord.staffRoles) if (guildMember.roles.cache.get(role)) account.staff = true;
        }
        
        res.end(JSON.stringify(account));
    }
}