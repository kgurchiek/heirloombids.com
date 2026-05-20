import { config, supabase } from '../lib.js';

export default {
    name: 'signup',
    description: 'Gets information about a roster signup',
    options: [
        {
            name: 'id',
            description: 'The id of the signup'
        },
        {
            name: 'ids',
            description: 'A JSON array of signup ids'
        }
    ],
    async execute({ res, end, url }) {
        let id = url.searchParams.get('id');
        let ids = url.searchParams.get('ids');
        if (id == null && ids == null) return end(400, { error: 'Missing required arg "id" or "ids"' });
        if (id != null && ids != null) return end(400, { error: 'Cannot use "id" and "ids" arg in the same request' });
        if (id != null) {
            if (isNaN(parseInt(id))) return end(400, JSON.stringify({ error: 'Invalid value for arg "id"', details: `"${id}" is not a number` }));
            id = parseInt(id);
        }
        if (ids == null) ids = [id];
        else {
            let error = false;
            try {
                ids = JSON.parse(ids);
            } catch (err) {
                error = true;
            }
            if (error || !Array.isArray(ids)) return end(400, JSON.stringify({ error: 'Invalid value for arg "ids"', details: `"${ids}" is not a JSON array` }));
        }
        
        let { data: signups, error } = await supabase.from(config.supabase.tables.signups).select('*').in('signup_id', ids);
        if (error) return end(500, { error: 'Error fetching signups', details: error.message });
        for (let id of ids) if (signups.find(a => a.signup_id == id) == null) return end(400, { error: `Couldn't find signup with id "${id}"` });
        if (id != null) {
            signups = signups[0];
        }

        res.end(JSON.stringify(signups));
    }
}