import { config, supabase, blockedBids, bidQueue } from '../lib.js';

export default {
    name: 'remove-bid',
    description: 'Deletes a bid on an item (staff only)',
    options: [
        {
            name: 'id',
            description: 'The id of the auction',
            required: true
        },
        {
            name: 'username',
            description: 'The user that placed the bid (staff only)'
        },
        {
            name: 'amount',
            description: 'The amount of points the bid was for (defaults to the highest bid placed by the user)'
        }
    ],
    async execute({ res, end, url, user }) {
        let id = url.searchParams.get('id');
        let username = url.searchParams.get('username');
        if (user.staff = false && username != null) return end(403, { error: 'Staff Only', details: `Only staff can delete other users' bids` });
        if (username == null) username == user.username;
        let amount = url.searchParams.get('amount');
        if (amount != null) {
            if (isNaN(parseInt(amount))) return end(400, JSON.stringify({ error: 'Invalid value for arg "amount"', details: `"${amount}" is not a number` }));
            amount = parseInt(amount);
        }

        let { data: auction, error } = await supabase.from(config.supabase.tables.auctions).select('*').eq('id', id).limit(1);
        if (error) return end(500, JSON.stringify({ error: 'Error Fetching Auction', details: error.message }));
        auction = auction[0];
        if (auction == null) return end(400, JSON.stringify({ error: `Couldn't find auction with id "${id}"` }));
        if (!auction.open) return end(400, JSON.stringify({ error: 'Auction Closed' }));

        let bid = auction.bids.filter(a => a.username == username && (amount == null || a.amount == amount)).sort((a, b) => b.amount - a.amount)[0];
        if (bid == null) return end(400, JSON.stringify({ error: `Couldn't find bid on auction ${id} with username "${username}"${amount == null ? '' : ` and amount ${amount}`}` }));
        auction.bids = auction.bids.filter(a => !(a.username == bid.username && a.amount == bid.amount));

        ({ data: auction, error } = await supabase.from(config.supabase.tables.auctions).update({ bids: auction.bids }).eq('id', auction.id).select('*'));
        if (error) return end(500, JSON.stringify({ error: 'Error Updating Auction', details: error.message }));
        auction = auction[0];
        if (auction == null) return end(400, JSON.stringify({ error: `Couldn't find auction with id "${id}"` }));
        if (!auction.open) return end(400, JSON.stringify({ error: 'Auction Closed' }));

        res.end(JSON.stringify(auction));
    }
}