import { closeAuction } from '../lib.js';

export default {
    name: 'close-auction',
    description: 'closes an auction',
    options: [
        {
            name: 'id',
            description: 'the id of the auction to close',
            required: true
        }
    ],
    async execute({ res, end, url, user }) {
        let id = url.searchParams.get('id');

        if (user.frozen) return end(403, JSON.stringify({ error: 'Account Frozen', details: 'Your account is frozen. You cannot manage auctions or place bids on items this time.' }));

        let auction = await closeAuction(id, user.username);
        if (auction.error) return end(auction.code || 500, JSON.stringify(auction));
        res.end(JSON.stringify(auction));
    }
}