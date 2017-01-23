const Client = require('../Client');

const client = new Client({
    port:          10101,
    autoReconnect: true,
    useQueue:      true
});

client.connect();

let i = 0;

setInterval(() => {
    const curLol = ++i;

    console.log(`SEND ${curLol}`);

    client.request('hello', { lol: curLol }).then(data => {
        console.log(`RES FOR ${curLol}`, data);
    }, err => {
        console.log(`ERR FOR ${curLol}`, err);
    })
}, 2000);
