const RequestServer = require('../RequestServer');

const server = new RequestServer((apiName, data) => {
    return new Promise(resolve => {
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
        console.log('^^^', err);
        return;
    }

    console.log('Listen 10101');
});

server.on('error', err => {
    console.log('server error:', err)
});
