JSON Transport Protocol

Server Example
```javascript
const RequestServer = require('rpc-easy/RequestServer');

const server = new RequestServer((apiName, data) => {
    return new Promise(resolve => {
        console.log(`Api call ${apiName}, data:`, data);
        setTimeout(() => {
            console.log(`RESP ${data.lol}`);
            resolve('OK');
        }, 5000);
    });
});

server.listen({
    host: 'localhost',
    port: 10101
}, err => {
    if (err) {
        console.log('Listen Error:', err);
        return;
    }

    console.log('Listen 10101');
});

server.on('error', err => {
    console.log('Server Error:', err)
});
```

Client Example
```javascript
const Client = require('rpc-easy/Client');

const client = new Client({
    port:          10101,
    autoReconnect: true,
    useQueue:      true,
});

client.connect();

let i = 0;

setInterval(() => {
    const curLol = ++i;

    console.log(`Request #${curLol}`);

    client.request('hello', { lol: curLol }).then(data => {
        console.log(`Response #${curLol}:`, data);
    }, err => {
        console.log(`Error ${curLol}`, err);
    });
}, 1000);
```
