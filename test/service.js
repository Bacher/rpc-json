const MicroServer = require('../MicroServer');

const server = new MicroServer();

server.on('connection', connection => {
    connection.setRequestHandler((apiName, data) => {
        return {
            st: 'OK',
            lolReturn: data.lol
        };
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


server.on('errro', err => {
    console.log('server error:', err)
});
