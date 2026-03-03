import fs from 'node:fs';
import http2 from 'node:http2';

const favicon = fs.readFileSync('static/favicon.ico');

let server = http2.createSecureServer({
    key: fs.readFileSync('/etc/letsencrypt/live/heirloombids.com/privkey.pem'),
    cert: fs.readFileSync('/etc/letsencrypt/live/heirloombids.com/cert.pem')
});

server.on('stream', (req, res) => {
    console.log(req);
    let url = new URL(`http://${req.headers.host}${req.url}`);

    if (url.pathname == '/favicon.ico') return res.end(favicon);

    res.end('hello');
})

server.listen(80);