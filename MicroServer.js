const net          = require('net');
const EventEmitter = require('events').EventEmitter;

const Connection = require('./Connection');

class MicroServer extends EventEmitter {

    constructor() {
        super();

        this._server = net.createServer(socket => {
            this.emit('connection', new Connection(socket));
        });

        this._server.on('error', err => this.emit('error', err));
    }

    listen(options, callback) {
        this._server.listen(options, err => {
            if (err) callback(err);
            else     callback();
        });
    }

    address() {
        return this._server.address();
    }
}

module.exports = MicroServer;
