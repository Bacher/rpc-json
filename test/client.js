const Client = require('../Client');

const conn = new Client({
    port: 10101,
    autoReconnect: true,
    useQueue: true
});

conn.connect();


let i = 0;

setInterval(() => {
    conn.send('hello', { lol: ++i }).then(data => {
        console.log('RESP', data);
    }, err => {
        console.log('ERR', err);
    })
}, 1000);
