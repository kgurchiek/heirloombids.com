import { config, supabase, supabaseCache } from '../lib.js';

export default {
    name: 'join-roster',
    description: 'Signs up for a roster',
    options: [
        {
            name: 'id',
            description: 'The id of the event to sign up for',
            required: true
        },
        {
            name: 'alliance',
            description: 'The alliance to join',
            required: true
        },
        {
            name: 'party',
            description: 'The party to join',
            required: true
        },
        {
            name: 'slot',
            description: 'The slot to fill',
            required: true
        },
        {
            name: 'job',
            description: 'The id of the job to sign up for',
            required: true
        },
        {
            name: 'todGrab',
            description: 'Whether or not it\'s a todgrab signup',
            accept: ['true', 'false'],
            caseInsensitive: true
        },
        {
            name: 'alt',
            description: 'Whether or not you\'re signing up with an alt account',
            accept: ['true', 'false'],
            caseInsensitive: true
        },
        {
            name: 'tagOnly',
            description: 'Whether or not you\'re signing up to tag',
            accept: ['true', 'false'],
            caseInsensitive: true
        }
    ],
    async execute({ res, end, url, user }) {
        let id = url.searchParams.get('id');
        let jobId = parseInt(url.searchParams.get('job'));
        let alliance = parseInt(url.searchParams.get('alliance'));
        let party = parseInt(url.searchParams.get('party'));
        let slot = parseInt(url.searchParams.get('slot'));
        let todGrab = url.searchParams.get('todGrab') == 'true';
        let alt = url.searchParams.get('alt') == 'true';
        let tagOnly = url.searchParams.get('tagOnly') == 'true';

        if (isNaN(jobId)) return end(400, { error: 'Invalid value for arg "job"', details: `"${url.searchParams.get('job')}" is not a number` });
        if (isNaN(alliance)) return end(400, { error: 'Invalid value for arg "alliance"', details: `"${url.searchParams.get('alliance')}" is not a number` });
        if (isNaN(party)) return end(400, { error: 'Invalid value for arg "party"', details: `"${url.searchParams.get('party')}" is not a number` });
        if (isNaN(slot)) return end(400, { error: 'Invalid value for arg "slot"', details: `"${url.searchParams.get('slot')}" is not a number` });

        let { data: event, error } = await supabase.from(config.supabase.tables.events).select('*').eq('event_id', id).limit(1);
        if (error) return end(500, { error: 'Error Fetching Event', details: error.message });
        event = event[0];
        if (event == null) return end(400, { error: `Couldn't find event with id "${id}"` });
        if (!event.active) return end(400, { error: 'Event closed' });

        let signups;
        ({ data: signups, error } = await supabase.from(config.supabase.tables.signups).select('*').eq('event_id', id).eq('active', true));
        if (error) return end(500, { error: 'Error Fetching Signups', details: error.message });
        if (signups.find(a => a.player_id == user.id) != null) return end(400, { error: 'You already signed up for this raid' });

        let job = supabaseCache[config.supabase.tables.jobs].find(a => a.job_id == jobId);
        if (job == null) return end(400, { error: `Couldn't find job with id "${jobId}"` });

        let template = supabaseCache[config.supabase.tables.templates].find(a => a.monster_name == event.monster_name && a.alliance_number == alliance && a.party_number == party && a.party_slot_number == slot);
        if (template == null) return end(400, { error: 'Invalid signup', details: `Couldn't find template for monster "${event.monster_name}", alliance ${alliance}, party ${party}, slot ${slot}` });

        if (!template.allowed_job_ids.includes(jobId)) return end(400, { error: `Job "${job.job_name}" not allowed for this slot` });
        if (signups.find(a => a.slot_template_id == template.slot_template_id) != null) return end(400, { error: 'Slot already taken' });

        let signup;
        ({ data: signup, error } = await supabase.from(config.supabase.tables.signups).insert({
            event_id: id,
            slot_template_id: template.slot_template_id,
            player_id: user.id,
            assigned_job_id: job.job_id,
            todgrab: todGrab,
            alt: alt,
            tag_only: tagOnly
        }).select('*'));
        if (error) return end(500, { error: 'Error creating signup', details: error.message });
        res.end(JSON.stringify(signup[0]));
    }
}