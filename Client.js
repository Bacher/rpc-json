const EventEmitter = require('events').EventEmitter;
const Connection   = require('./Connection');

class Client extends EventEmitter {

    /**
     * @param {Object}    options
     * @param {number}    options.port
     * @param {function}  options.requestHandler
     * @param {string}   [options.host='localhost']
     * @param {boolean}  [options.useQueue=false]
     * @param {number}   [options.timeout=10000] ms
     * @param {number}   [options.queueTimeout=5000] ms
     * @param {boolean}  [options.autoReconnect=false]
     * @param {number}   [options.reconnectDelay=500] ms
     */
    constructor(options) {
        super();

        this._conn   = null;
        this._closed = true;

        this._host = options.host || 'localhost';
        this._port = options.port;

        this._timeout = options.timeout || 10000;

        this._reconnectTimeoutId = null;

        this._queue          = options.useQueue ? [] : null;
        this._queueTimeout   = options.queueTimeout || 5000;
        this._autoReconnect  = Boolean(options.autoReconnect);
        this._reconnectDelay = options.reconnectDelay || 500;

        this._requestHandler = options.requestHandler;
    }

    connect() {
        if (!this._closed) {
            throw new Client.AlreadyConnectedError();
        }

        this._closed = false;

        this._connect();
    }

    _connect() {
        Connection.connect({
            host: this._host,
            port: this._port
        }).then(conn => {
            this._setConnection(conn);
        }, err => {
            this.emit('fail', err);

            if (this._autoReconnect) {
                this._reconnect();
            }
        });
    }

    close() {
        if (this._conn) {
            this._conn.close();
            this._conn = null;
        }

        this._closed = true;

        if (this._reconnectTimeoutId) {
            clearTimeout(this._reconnectTimeoutId);

            if (this._queue) {
                for (let requestInfo of this._queue) {
                    clearTimeout(requestInfo.timeoutId);
                    requestInfo.reject(new Client.ClosingError());
                }
            }
        }
    }

    _setConnection(connection) {
        this._conn = connection;

        if (this._timeout) {
            this._conn.setTimeout(this._timeout);
        }

        this._conn.setRequestHandler(this._requestHandler);

        this._conn.on('error', noop);

        this._conn.on('close', () => {
            this.emit('disconnect');

            this._conn = null;

            if (!this._closed && this._autoReconnect) {
                this._reconnect();
            }
        });

        this._conn.on('message', data => {
            this.emit('message', data);
        });

        this.emit('connect');

        if (this._queue) {
            for (let requestInfo of this._queue) {
                clearTimeout(requestInfo.timeoutId);
                requestInfo.resolve(this._conn.request(requestInfo.apiName, requestInfo.data));
            }

            this._queue = [];
        }
    }

    _reconnect() {
        this._reconnectTimeoutId = setTimeout(() => {
            this._reconnectTimeoutId = null;
            this._connect();
        }, this._reconnectDelay);
    }

    send(data) {
        if (!this._conn) {
            throw new Connection.SocketClosedError();
        }

        return this._conn.send(data);
    }

    request(apiName, data) {
        if (this._conn) {
            return this._conn.request(apiName, data);
        } else if (this._queue) {
            return new Promise((resolve, reject) => {
                const requestData = {
                    apiName:   apiName,
                    data:      data,
                    resolve:   resolve,
                    reject:    reject,
                    timeoutId: setTimeout(() => {
                        this._queue.shift();
                        reject(new Client.QueueTimeout());
                    }, this._queueTimeout)
                };

                this._queue.push(requestData);
            });
        } else {
            return Promise.reject(new Connection.SocketClosedError());
        }
    }

}

function noop() {}

const ClientError = Client.ClientError = class ClientError extends Connection.BaseError {};

Client.QueueTimeout = class QueueTimeout extends ClientError {
    constructor() {
        super('Queue timeout reached');
    }
};

Client.ClosingError = class ClosingError extends ClientError {
    constructor() {
        super('Client are closing');
    }
};

Client.AlreadyConnectedError = class AlreadyConnectedError extends ClientError {
    constructor() {
        super('Already connected');
    }
};

module.exports = Client;
