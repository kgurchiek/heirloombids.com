import fs from 'node:fs';
import util from 'node:util';
import http from 'node:http';
import http2 from 'node:http2';
import crypto from 'node:crypto';
import readline from 'node:readline';
import cookie from 'cookie';
import { config, publicKey, privateKey, client, getUser, updateCache, supabaseCache } from './lib.js';
import { Events } from 'discord.js';

const origin = `${config.web.https ? 'https' : 'http'}://${config.web.hostname}`;

let authUrl = new URL(origin);
authUrl.pathname = '/auth';
let oauthUrl = new URL(config.web.oauth);
oauthUrl.searchParams.set('redirect_uri', authUrl.href);
let registerUrl = new URL(origin);
registerUrl.pathname = '/register';
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
console.log(`[API]: Loaded ${count} endpoint${count == 1 ? '' : 's'}`);

if (await updateCache()) process.exit();
count = Object.keys(supabaseCache).length;
console.log(`[Supabase Cache]: Cached ${count} table${count == 1 ? '' : 's'}`);

let staticFiles = {};
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
staticFiles = staticFiles.static;

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

let requestQueue = [];
async function handleRequestQueue() {
    let queue = requestQueue.splice(0);
    for (let item of queue) await item();
    setTimeout(handleRequestQueue);
}
handleRequestQueue();

function handleRequest(req, res) {
    res.setHeader('Access-Control-Allow-Origin', req.headers.origin || origin);
	res.setHeader('Access-Control-Allow-Headers', '*');
	res.setHeader('Access-Control-Request-Method', '*');
	res.setHeader('Access-Control-Allow-Methods', 'GET');
    res.setHeader('Access-Control-Allow-Credentials', 'true');

    if (req.method == 'OPTIONS') {
        res.statusCode = 204;
        return res.end();
    }

    requestQueue.push(async () => {
        let url = new URL(`${origin}${req.url}`);

        function end(code, body) {
            if (code != null) res.statusCode = code;
            res.end(typeof body == 'object' ? JSON.stringify(body) : body);
        }

        function redirect(location) {
            res.setHeader('Location', location);
            end(303);
            
            // end(200, JSON.stringify({ redirect: location }));
        }

        function authRedirect(state, force) {
            state = state || url.href;
            let redirectUrl = new URL(oauthUrl.href);
            redirectUrl.searchParams.set('state', state);

            if (force) return redirect(redirectUrl.href);
            return end(200, JSON.stringify({ redirect: redirectUrl.href }));
        }

        try {
            let cookies = cookie.parseCookie(req.headers.cookie || '');

            console.log(req.socket.remoteAddress, `${url.pathname}${url.search}`);

            if (url.pathname == '/auth') {
                let state = url.searchParams.get('state') || origin;
                let valid = false;
                try {
                    let u = new URL(state)
                    if (['http:', 'https:'].includes(u.protocol)) valid = true;
                } catch (err) {}
                if (state == null || !valid) return end(400, { error: 'Invalid state url' });
                let code = url.searchParams.get('code');
                if (code == null) return authRedirect(state, true);
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
                if (response.status == 400) return authRedirect(state, true);
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
                if (response.status == 401) return authRedirect(state, true);
                else if (response.status != 200) {
                    console.log('Error fetching user data:', await response.json());
                    end(500, `Discord API returned code ${response.status}`);
                    return;
                }
                let user = await response.json();
                
                res.appendHeader('set-cookie', `token=${createToken(JSON.stringify({ id: user.id, exp: Math.floor(Date.now() / 1000) + config.jwt.lifetime }))}; domain=${config.web.cookieDomain}`);
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
                // console.log(err);
                return authRedirect();
            }

            let user = await getUser(payload.id);
            if (config.discord.registerBypass.includes(payload.id)) user = payload;
            if (user.error) {
                console.log('Error fetching db user:', user.error)
                end(500, errorPages[500]);
                return;
            }
            if (config.discord.registerBypass.includes(payload.id)) user.staff = false;
            else {
                let guildMember;
                try {
                    guildMember = await guild.members.fetch(user.id);
                } catch (err) {
                    res.setHeader('Content-Type', 'application/json');
                    return end(403, { error: 'Must be a member of the Discord server to access api' });
                }
                user.staff = false;
                for (const role of config.discord.staffRoles) if (guildMember.roles.cache.get(role)) user.staff = true;
            }
            
            let path = url.pathname.slice(1).split('/');
            if (path[path.length - 1] == '') path = path.slice(0, -1);
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

                        if (value != null && option.accepts != null && !option.accepts.map(a => (typeof a == 'string' && option.caseInsensitive) ? a.toLowerCase() : a).includes((typeof value == 'string' && option.caseInsensitive) ? value.toLowerCase() : value)) {
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

            let page = staticFiles;
            for (let i = 0; page != null && i < path.length; i++) page = page[path[i]] || page[`${path[i]}.html`];
            if (!Buffer.isBuffer(page) && typeof page == 'object') page = page['index.html'];
            if (page != null) return res.end(page);
            
            end(404, errorPages[404]);
        } catch (err) {
            console.error(err);
            end(500, errorPages[500]);
            return;
        }
    })
}

if (config.web.https) {
    let server = http2.createSecureServer({
        key: fs.readFileSync(config.web.privateKey),
        cert: fs.readFileSync(config.web.certificate)
    });
    server.on('error', (err) => console.error(err));
    server.on('request', handleRequest);
    server.listen(config.web.port);
} else http.createServer(handleRequest).listen(config.web.port);