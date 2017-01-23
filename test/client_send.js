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

    client.send(`hello_${curLol}`);
}, 2000);
