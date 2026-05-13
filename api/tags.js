import { config, supabase, supabaseCache } from '../lib.js';

export default {
    name: 'tags',
    description: 'Gets a count of monster tags',
     options: [
        {
            name: 'user',
            description: 'The id of the user that tagged the monster'
        },
        {
            name: 'monster',
            description: 'The monster that was tagged'
        }
    ],
    async execute({ res, end, url }) {
        let user = url.searchParams.get('user');
        let monster = url.searchParams.get('monster');

        let tags = supabaseCache[config.supabase.tables.tags];
        if (user != null) tags = tags.filter(a => a.player_id == user);
        if (monster != null) tags = tags.filter(a => a.monster_name == monster);

        res.end(JSON.stringify(tags.length));
    }
}