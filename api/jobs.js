import { config, supabaseCache } from '../lib.js';

export default {
    name: 'jobs',
    description: 'Gets a list of jobs',
    async execute({ res }) {
        res.end(JSON.stringify(supabaseCache[config.supabase.tables.jobs]));
    }
}