const net          = require('net');
const EventEmitter = require('events').EventEmitter;

const Connection = require('./Connection');

class Server extends EventEmitter {

    constructor(options) {
        super();

        this._suppressSocketErrors = Boolean(options.suppressSocketErrors);

        this._server = net.createServer(socket => {
            const connection = new Connection(socket);

            if (this._suppressSocketErrors) {
                connection.on('error', noop);
            }

            this.emit('connection', connection);
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

function noop() {}

module.exports = Server;

