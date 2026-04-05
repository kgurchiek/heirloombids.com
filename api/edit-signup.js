import { config, supabase, supabaseCache } from '../lib.js';

export default {
    name: 'edit-signup',
    description: 'Edit a roster signup',
    options: [
        {
            name: 'id',
            description: 'The id of the signup to edit',
            required: true
        },
        {
            name: 'update',
            description: 'JSON of new data to update',
            required: true
        }
    ],
    async execute({ res, end, url, user }) {
        let id = url.searchParams.get('id');
        let edit;
        try {
            edit = JSON.parse(url.searchParams.get('update'));
        } catch (err) {
            return end(400, { error: 'Error parsing arg "signup"', details: err.message });
        }

        let keys = Object.keys(edit);
        if (!user.staff) for (let key of keys) if (!config.roster.signupEdits.includes(key)) return end(403, { error: `Only staff can edit column "${key}"` });
        
        let { data: signup, error } = await supabase.from(config.supabase.tables.signups).select('*').eq('signup_id', id);
        if (error) return end(500, { error: 'Error Fetching Signup', details: error.message });
        signup = signup[0];
        if (signup == null) return end(400, { error: `Couldn't find signup with id "${id}"` });
        if (signup.verified) return end(400, { error: 'Signup has already been verified' });
        if (!(user.staff || signup.player_id == user.id)) return end(403, { error: 'Only staff can edit other users\' signups' });

        if (edit.slot_template_id !== undefined) {
            let template = supabaseCache[config.supabase.tables.templates].find(a => a.slot_template_id == edit.slot_template_id);
            if (template == null) return end(400, { error: `Couldn't find template with id "${edit.slot_template_id}` });
            let jobId = edit.assigned_job_id || signup.assigned_job_id;
            let job = supabaseCache[config.supabase.tables.jobs].find(a => a.job_id == jobId);
            if (job == null) return end(edit.assigned_job_id === undefined ? 500 : 400, { error: `Couldn't find job with id "${jobId}"` });
            if (!template.allowed_job_ids.includes(jobId)) return end(400, { error: `Slot doesn't allow job "${job.job_name}"` });

            let { data: event, error } = await supabase.from(config.supabase.tables.events).select('*').eq('event_id', signup.event_id).limit(1);
            if (error) return end(500, { error: 'Error fetching event', details: error.message });
            event = event[0];

            let signups;
            ({ data: signups, error } = await supabase.from(config.supabase.tables.signups).select('*').eq('event_id', signup.event_id));
            if (error) return end(500, { error: 'Error fetching signups', details: error.message });
            if (event.active && signups.find(a => a.slot_template_id == edit.slot_template_id)) return end(400, { error: 'Slot already taken' });
        }

        ({ data: signup, error } = await supabase.from(config.supabase.tables.signups).update(edit).eq('signup_id', id).select('*'));
        if (error) return end(500, { error: 'Error editing signup', details: error.message });
        res.end(JSON.stringify(signup[0]));
    }
}