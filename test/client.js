const Client = require('../Client');

const conn = new Client({
    port: 10101,
    autoReconnect: true,
    useQueue: true
});

conn.connect();

let i = 0;

setInterval(() => {
    const curLol = ++i;
    console.log(`SEND ${curLol}`);
    conn.send('hello', { lol: curLol }).then(data => {
        console.log(`RES FOR ${curLol}`, data);
    }, err => {
        console.log(`ERR FOR ${curLol}`, err);
    })
}, 5000);
