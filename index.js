import fs from 'node:fs';
import util from 'node:util';
import http2 from 'node:http2';
import crypto from 'node:crypto';
import readline from 'node:readline';
import cookie from 'cookie';
import { createClient } from '@supabase/supabase-js';
import { Client, Partials, Events, GatewayIntentBits } from 'discord.js';

const config = JSON.parse((await fs.promises.readFile('config.json')).toString());
const supabase = createClient(config.supabase.url, config.supabase.key);
const favicon = await fs.promises.readFile('static/favicon.ico');
const errorPages = {};
await Promise.all((await fs.promises.readdir('error')).map(async a => errorPages[a.slice(0, a.lastIndexOf('.'))] = (await fs.promises.readFile(`error/${a}`)).toString()));
const commands = {};
await Promise.all((await fs.promises.readdir('api')).map(async a => {
    let command = (await import(`./api/${a}`)).default;
    commands[command.name] = command;
}));

let publicKey, privateKey;
try {
    publicKey = (await fs.promises.readFile(config.jwt.publicKey)).toString();
    privateKey = (await fs.promises.readFile(config.jwt.privateKey)).toString();
} catch (err) {}

if (publicKey == null || privateKey == null) {
    let rl = readline.promises.createInterface({ input: process.stdin, output: process.stdout });
    let input;
    while (!['', 'yes', 'y', 'no', 'n'].includes(input)) input = (await rl.question('Missing public or private key, would you like to generate a new pair? (Y/n) ')).toLowerCase();
    rl.close();
    if (['no', 'n'].includes(input)) process.exit();
    
    ({ publicKey, privateKey } = await util.promisify(crypto.generateKeyPair)('ec', {
        namedCurve: 'P-256',
        privateKeyEncoding: { format: 'pem', type: 'pkcs8' },
        publicKeyEncoding: { format: 'pem', type: 'spki' }
    }));
    await fs.promises.writeFile(config.jwt.publicKey, publicKey);
    await fs.promises.writeFile(config.jwt.privateKey, privateKey);
}

const btoaUrl = (data) => btoa(data).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
const atobUrl = (data) => atob(data.replaceAll('-', '+').replaceAll('_', '/'));

function createToken(payload) {
    let header = btoaUrl(JSON.stringify({ alg: 'ES256', typ: 'JWT' }));
    payload = btoaUrl(payload);
    let key = `${header}.${payload}`;
    let secret = crypto.sign('sha256', Buffer.from(key), privateKey).toString('base64').replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
    key += `.${secret}`;
    return key;
}

function parseToken(token) {
    let [header, payload, secret] = token.split('.');
    secret = crypto.verify('sha256', `${header}.${payload}`, publicKey, Buffer.from(secret, 'base64'));
    payload = atobUrl(payload);
    return { payload, secret };
}

async function getUser(id) {
    let { data: user, error } = await supabase.from(config.supabase.tables.users).select('*').eq('id', id).limit(1);
    return error ? { error } : user[0];
}

let bidQueue = [];
let blockedBids = [];
const blockBid = (id, callback) => blockedBids.push({ id, callback });
const unblockBid = (id) => blockedBids = blockedBids.filter(a => a.id != id);
const handleBidQueue = async () => {
    for (let bid of blockedBids) if (bidQueue.find(a => a.id == bid.id) == null) bid.callback();
    if (bidQueue.length) await bidQueue.splice(0, 1)[0].func();
    setTimeout(handleBidQueue);
}
handleBidQueue();

const client = new Client({ partials: [Partials.Channel, Partials.GuildMember, Partials.Message], intents: [GatewayIntentBits.Guilds, GatewayIntentBits.DirectMessages, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildMessages] });
let guild;
client.once(Events.ClientReady, async () => {
    console.log(`[Bot]: ${client.user.tag}`);
    console.log(`[Servers]: ${client.guilds.cache.size}`);
    guild = await client.guilds.fetch(config.discord.server);
    console.log('[Guild]:', guild.name);
});
client.login(config.discord.token);

let server = http2.createSecureServer({
    key: fs.readFileSync(config.web.privateKey),
    cert: fs.readFileSync(config.web.certificate)
});
server.on('error', (err) => console.error(err));

server.on('request', async (req, res) => {
    let url = new URL(`https://heirloombids.com${req.url}`);

    function end(code, body) {
        if (code != null) res.statusCode = code;
        res.end(body);
    }

    function redirect(location) {
        res.setHeader('Location', location);
        end(303);
    }

    function authRedirect(state, location) {
        state = state || url.href;
        location = location || config.web.oauth;
        console.log(state)
        let location = new URL(location);
        location.searchParams.set('state', state);
        redirect(location.href);
    }

    try {
        let cookies = cookie.parseCookie(req.headers.cookie || '');

        if (url.pathname == '/favicon.ico') return res.end(favicon);
        
        console.log(req.socket.remoteAddress, url.pathname);

        if (url.pathname == '/auth') {
            let state = url.searchParams.get('state') || 'https://heirloombids.com';
            let valid = true;
            try {
                new URL(state)
                valid = true;
            } catch (err) {}
            if (state == null || !valid) return end(400, errorPages[400]);
            let code = url.searchParams.get('code');
            if (code == null) return end(400, errorPages[400]);
            let response = await fetch('https://discord.com/api/v10/oauth2/token', {
                method: 'POST',
                headers: {
                    Authorization: `Basic ${btoa(`${config.discord.id}:${config.discord.secret}`)}`,
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: new URLSearchParams({
                    grant_type: 'authorization_code',
                    code,
                    redirect_uri: 'https://heirloombids.com/auth'
                }).toString()
            });
            if (response.status == 400) return authRedirect(state);
            else if (response.status != 200) {
                console.log('Error fetching token:', await response.json());
                end(500, `Discord API returned code ${response.status}`);
                return;
            }
            let data = await response.json();
            
            let token = data.access_token;
            response = await fetch('https://discord.com/api/v10/users/@me', {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });
            if (response.status == 401) return authRedirect(state);
            else if (response.status != 200) {
                console.log('Error fetching user data:', await response.json());
                end(500, `Discord API returned code ${response.status}`);
                return;
            }
            let user = await response.json();
            
            res.appendHeader('set-cookie', `token=${createToken(JSON.stringify({ id: user.id, exp: Math.floor(Date.now() / 1000) + config.jwt.lifetime }))}`);
            redirect(state);
            return;
        }
        
        let payload;
        try {
            let token = parseToken(cookies.token);
            if (!token.secret) return authRedirect();
            payload = JSON.parse(token.payload);
            if (Math.floor(Date.now() / 1000) >= payload.exp) return authRedirect();
        } catch (err) {
            return authRedirect();
        }

        let user = await getUser(payload.id);
        if (user.error) {
            console.log('Error fetching db user:', user.error)
            end(500, errorPages[500]);
            return;
        }
        if (user == null) return authRedirect(null, 'https://heirloombids.com/register');
        let guildMember = await guild.members.fetch(user.id);
        user.staff = false;
        for (const role of config.discord.staffRoles) if (guildMember.roles.cache.get(role)) user.staff = true;
        
        let path = url.pathname.slice(1).split('/');
        if (path[0] == 'api') {
            let command = path[1];
            let input = {
                config,
                req,
                res,
                end,
                url,
                user,
                client,
                supabase,
                blockBid,
                unblockBid,
                blockedBids,
                bidQueue,
                // auctions,
                // auctionChannels,
                // rollChannel,
                // itemList,
                // monsterList,
                // userList,
                // jobList,
                // templateList,
                // campRules,
                // pointRules,
                // groupList,
                // tagList,
                // lootHistory,
                // eventList,
                // signupList,
                // monsters,
                // archive,
                // rosterChannels,
                // ocrCategory,
                // logChannel,
                // memberScreenshotsChannel,
                // rewardHistoryChannel,
                // graphChannels,
                // Monster,
                // updateTagRates,
                // updateGraphs,
                // messageCallbacks,
                getUser,
                // calculateCampPoints,
                // calculateBonusPoints
            }
            if (commands[command]) {
                res.setHeader('Content-Type', 'application/json');
                command = commands[command];
                for (let option of command.options || []) {
                    let value = url.searchParams.get(option.name);
                    if (option.required && value == null) return end(400, JSON.stringify({ error: `Missing required arg "${option.name}"` }));

                    if (option.accepts != null && !option.accepts.includes((typeof value == 'string' && option.caseInsensitive) ? value.toLowerCase() : value)) {
                        res.statusCode = 400;
                        res.end(JSON.stringify({ error: `"${value}" is not an accepted value for arg "${option.name}"` }));
                        return;
                    }
                }
                try {
                    await command.execute(input);
                } catch (err) {
                    console.log(err);
                    end(500, JSON.stringify({ error: 'Internal Error' }));
                }
                return;
            }
        }

        end(404, errorPages[404])
    } catch (err) {
        console.error(err);
        end(500, errorPages[500]);
        return;
    }
})

server.listen(443);