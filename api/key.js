import { publicKey } from '../lib.js';

export default {
    name: 'key',
    description: 'Gets the public key to verify jwt tokens',
    async execute({ res }) {
        res.setHeader('Content-Type', 'text/plain');
        res.end(publicKey);
    }
}