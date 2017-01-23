const net          = require('net');
const EventEmitter = require('events').EventEmitter;

const Connection = require('./Connection');

class Server extends EventEmitter {

    /**
     * @param {Object} [options]
     * @param {boolean}  [options.redirectErrors=false] - redirect all errors to server
     * @param {boolean}  [options.suppressSocketErrors=false] - deprecated! suppress all errors
     */
    constructor(options) {
        super();

        this._server = net.createServer(socket => {
            const connection = new Connection(socket);

            if (options.suppressSocketErrors) {
                connection.on('error', noop);
            } else if (options.redirectErrors) {
                connection.on('error', err => this.emit('error', err));
            }

            if (options.requestHandler) {
                connection.setRequestHandler(options.requestHandler);
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

    close() {
        this._server.close();
    }

}

function noop() {}

module.exports = Server;

