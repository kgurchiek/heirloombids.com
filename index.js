import fs from 'node:fs';
import util from 'node:util';
import http2 from 'node:http2';
import crypto from 'node:crypto';
import readline from 'node:readline';
import cookie from 'cookie';
import { config, client, getUser, updateCache, supabaseCache } from './lib.js';
import { Events } from 'discord.js';

let authUrl = new URL(`https://${config.web.hostname}`);
authUrl.pathname = '/auth';
let oauthUrl = new URL(config.web.oauth);
oauthUrl.searchParams.set('redirect_uri', authUrl.href);
let registerUrl = new URL(`https://${config.web.hostname}`);
registerUrl.pathname = '/register';
const favicon = await fs.promises.readFile('static/favicon.ico');
const errorPages = {};
await Promise.all((await fs.promises.readdir('error')).map(async a => errorPages[a.slice(0, a.lastIndexOf('.'))] = (await fs.promises.readFile(`error/${a}`)).toString()));
let count = Object.keys(errorPages).length;
console.log(`[Pages]: Loaded ${count} error page${count == 1 ? '' : 's'}`)
const api = {};
count = 0;
let promises = ((await fs.promises.readdir('api')).map(a => (async () => {
    let endpoint = (await import(`./api/${a}`)).default;
    api[endpoint.name] = endpoint;
    count++;
})));
for (let promise of promises) await promise();
console.log(`[API]: Loaded ${count} endpoint${count == 1 ? '' : 's'}`)

if (await updateCache()) process.exit();
count = Object.keys(supabaseCache).length;
console.log(`[Supabase Cache]: Cached ${count} table${count == 1 ? '' : 's'}`);

const staticFiles = {};
async function readFile(path) {
    let stat = await fs.promises.stat(path.join('/'));
    if (stat.isDirectory()) await Promise.all((await fs.promises.readdir(path.join('/'))).map(async a => await readFile(path.concat(a))));
    else {
        let object = staticFiles;
        for (let directory of path.slice(0, -1)) {
            if (object[directory] == null) object[directory] = {};
            object = object[directory];
        }
        object[path[path.length - 1]] = await fs.promises.readFile(path.join('/'));
    }
}
await readFile(['static']);

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

let requestQueue = [];
async function handleRequestQueue() {
    let queue = requestQueue.splice(0);
    for (let item of queue) await item();
    setTimeout(handleRequestQueue);
}
handleRequestQueue();

server.on('request', (req, res) => requestQueue.push(async () => {
    let url = new URL(`https://localhost${req.url}`);
    url.hostname = config.web.hostname;

    function end(code, body) {
        if (code != null) res.statusCode = code;
        res.end(typeof body == 'object' ? JSON.stringify(body) : body);
    }

    function redirect(location) {
        res.setHeader('Location', location);
        end(303);
    }

    function authRedirect(state, location) {
        state = state || url.href;
        location = location || oauthUrl.href;
        let redirectUrl = new URL(location);
        redirectUrl.searchParams.set('state', state);
        redirect(redirectUrl.href);
    }

    try {
        let cookies = cookie.parseCookie(req.headers.cookie || '');

        if (url.pathname == '/favicon.ico') return res.end(favicon);
        
        console.log(req.socket.remoteAddress, `${url.pathname}${url.search}`);

        if (url.pathname == '/auth') {
            let state = url.searchParams.get('state') || `https://${config.web.hostname}`;
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
                    redirect_uri: authUrl
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

        if (url.pathname == '/register') {
            return res.end(staticFiles['register.html']);
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
        if (config.discord.registerBypass.includes(payload.id)) user = payload;
        if (user == null) return authRedirect(null, registerUrl.href);
        if (user.error) {
            console.log('Error fetching db user:', user.error)
            end(500, errorPages[500]);
            return;
        }
        let guildMember = await guild.members.fetch(user.id);
        user.staff = false;
        for (const role of config.discord.staffRoles) if (guildMember.roles.cache.get(role)) user.staff = true;
        
        let path = url.pathname.slice(1).split('/');
        if (path[0] == 'api') {
            let endpoint = path[1];
            let input = {
                req,
                res,
                end,
                url,
                user
            }
            if (api[endpoint]) {
                res.setHeader('Content-Type', 'application/json');
                let apiModule = api[endpoint];
                for (let option of apiModule.options || []) {
                    let value = url.searchParams.get(option.name);
                    if (option.required && value == null) return end(400, { error: `Missing required arg "${option.name}"` });

                    if (value != null && option.accepts != null && !option.accepts.includes((typeof value == 'string' && option.caseInsensitive) ? value.toLowerCase() : value)) {
                        res.statusCode = 400;
                        res.end(JSON.stringify({ error: `"${value}" is not an accepted value for arg "${option.name}"` }));
                        return;
                    }
                }
                try {
                    await apiModule.execute(input);
                } catch (err) {
                    console.log(err);
                    end(500, { error: 'Internal Error' });
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
}));

server.listen(443);