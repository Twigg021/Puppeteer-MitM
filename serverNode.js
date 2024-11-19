console.log('Host: Checking libraries...');
const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');
const puppeteer = require('puppeteer');
const { timeout } = require('puppeteer');
console.log('Host: Checked libraries.');

console.log('Host: Starting app...');
const app = express();
app.use(cors());
app.use(express.json());
console.log('Host: App started.')

let currentEntry = 'Start--';
let clients = [];
let active = false;
let browser;

(async () => {
    console.log('Host: Launching browser...');
    browser = await puppeteer.launch({ headless: false });
    active = true;
    console.log('Host: Launched browser.')
})();

function client(ip, url, page, instance, res, pageReq) {
    this.ip = ip;
    this.url = url;
    this.page = page;
    this.instance = instance;
    this.res = res;
    this.pageReq = pageReq;
}

const filePath = path.join(__dirname, 'index.html');
const hostInstance = Date.now();

app.use(express.static(path.join(__dirname, 'public')));

app.get('/seek/*', async (req, res) => {
    const entry = req.params[0]
    await handleInitialConnect(entry, req, res);
});

app.get('', async (req, res) => {
    const entry = undefined;
    await handleInitialConnect(entry, req, res);
});

async function handleInitialConnect(entry, req, res) {
    if(!active) return;
    if(entry == undefined || entry == '') entry = 'store.steampowered.com/'
    entry = 'https://' + entry;
    const clientInstance = Date.now();
    fs.readFile(filePath, 'utf-8', (err, content) => {
        res.end(content.replace('{{MESSAGE}}', clientInstance), 'utf-8')
    });
    console.log(req.ip + ': Requested basic- ' + entry);

    clients.push(new client(req.ip, entry, null, clientInstance, null, 0))
}

app.post('/prox', async (req, res) => {
    try{
    const originalURL = req.body.originalURL;
    const response = await fetch(originalURL);
    const data = await response.text();
    res.send(data);
    } catch(e){}
})

app.get('/strt/:entry', async (req, res) => {
    if(!active) return;
    const entry = req.params.entry.split('.');
    const client = clients.find(client => client.ip == req.ip && client.instance == entry[0])
    let page = client?.page || undefined;

    if(!client) {
        res.end();
        return;
    };

    console.log(req.ip + ': Connected.');

    if(!page) {
        console.log(client.ip + ': Creating page...')

        const width = Number(entry[1]);
        const height = Number(entry[2]);

        page = await browser.newPage();
        await page.setViewport({ width, height });
        client.page = page;
        await page.goto(client.url);

        console.log(client.ip + ': Created Page.')
    }

    client.res = res;

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    await page.waitForNetworkIdle();

    res.write(`data: ${JSON.stringify({content: await page.content(), url: client.url})}\n\n`);

    page.on('request', async () => {
            client.pageReq = 1;
            await page.waitForNetworkIdle();
            client.pageReq = 0;
    })

    page.on('load', async () => {
        res.write(`data: ${JSON.stringify({content: await page.content(), url: client.url})}\n\n`);
        try {
            await page.waitForNetworkIdle()
            res.write(`data: ${JSON.stringify({content: await page.content(), url: client.url})}\n\n`);
        } catch(e) {}
    })

    page.on('domcontentloaded', async () => {
        res.write(`data: ${JSON.stringify({content: await page.content(), url: client.url})}\n\n`);
        try {
            await page.waitForNetworkIdle()
            res.write(`data: ${JSON.stringify({content: await page.content(), url: client.url})}\n\n`);
        } catch(e) {}
    })

    page.on('')

    req.on('close', () => {
        clients = clients.filter(client => client.res != res);
        client.page.close();
        res.end();
        console.log(req.ip + ': Disconnected.');
    });
});

app.post('/updt/:entry', async (req, res) => {
    if(!active) return;
    const entry = req.params.entry;
    const client = clients.find(client => client.ip == req.ip && client.instance == entry)
    const page = client.page
    const eventData = req.body;
    const { type, x, y, key, value, element } = eventData;
    let tempVar = 0;

    try{
    switch (type) {
        case 'click':
            await page.click('xpath/' + element)
                if(client.pageReq == 1) {
                    tempVar = 1;
                }
            if(tempVar==0) return;
            await page.waitForNetworkIdle();
            client.res.write(`data: ${JSON.stringify({content: await page.content(), url: client.url})}\n\n`);
        break;
        case 'keydown':
            await page.keyboard.press(key);
            if(key=='Enter') {
                if(client.pageReq == 1) {
                    tempVar = 1;
                }
                if(tempVar==0) return;
                await page.waitForNetworkIdle();
                client.res.write(`data: ${JSON.stringify({content: await page.content(), url: client.url})}\n\n`);
            }
        break;
        case 'mousemove':
            await page.mouse.move(x, y)
        break;
    }
    } catch(e){console.log(e)}
    res.end();
})

app.listen(80, '0.0.0.0', () => {
  console.log(`Host: Server launched.`);
});
