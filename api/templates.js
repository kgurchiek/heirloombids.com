import { config, supabaseCache } from '../lib.js';

export default {
    name: 'templates',
    description: 'Gets a list of monster roster templates',
    options: [
        {
            name: 'monster',
            description: 'Which monster the template is for'
        }
    ],
    async execute({ res, url, end }) {
        let monster = url.searchParams.get('monster');

        let templates = supabaseCache[config.supabase.tables.templates];
        if (monster != null) templates = templates.filter(a => a.monster_name == monster);
        
        res.end(JSON.stringify(templates));
    }
}