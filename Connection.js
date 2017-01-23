const net          = require('net');
const EventEmitter = require('events').EventEmitter;

class Connection extends EventEmitter {

    static connect(options) {
        return new Promise((resolve, reject) => {
            const socket = net.connect(options, () => {
                socket.removeListener('error', onError);

                resolve(new Connection(socket));
            });

            socket.on('error', onError);

            function onError(err) {
                reject(err);
            }
        });
    }

    constructor(socket) {
        if (!socket) {
            throw new Error('Socket must be exists');
        }

        super();

        this._socket = socket;

        this._packetId  = 0;
        this._requestId = 0;

        this._ended = false;

        this._msgLen    = 0;
        this._msgBufLen = 0;
        this._msgBufs   = null;

        this._requests = new Map();

        this._bindEvents(this._socket);
    }

    _bindEvents() {
        this._socket
            .on('error', err      => this._onError(err))
            .on('end',   ()       => this._onEnd())
            .on('close', hadError => this._onClose(hadError))
            .on('data',  data     => this._processPart(data));
    }

    _onEnd() {
        this._ended = true;

        this._failCurrentRequests();

        this.emit('end');
    }

    _onError(err) {
        this._ended = true;
        this.emit('error', err);
    }

    _onClose(hadError) {
        this._ended = true;

        this._failCurrentRequests();

        this.emit('close', hadError);
    }

    _failCurrentRequests() {
        const error = new Connection.SocketCloseError();

        for (let callbacks of this._requests.values()) {
            callbacks.reject(error);
        }

        this._requests.clear();
    }

    setRequestHandler(callback) {
        this._requestHandler = callback;
        return this;
    }

    send(data) {
        this._send({
            type: 'send',
            data
        });
    }

    request(name, data) {
        return new Promise((resolve, reject) => {
            this._requestId++;

            this._send({
                type:        'request',
                requestId:   this._requestId,
                requestName: name,
                data:        data
            });

            this._requests.set(this._requestId, { resolve, reject });
        });
    }

    close() {
        this._socket.end();
    }

    destroy() {
        this._socket.destroy();
    }

    _send(data) {
        if (this._ended) {
            throw new Connection.SocketCloseError();
        }

        data.packetId = ++this._packetId;

        const buf = new Buffer(JSON.stringify(data));

        const preamble = new Buffer(4);
        preamble.writeUInt32BE(buf.length, 0);

        this._socket.write(Buffer.concat([preamble, buf]));
    }

    _processPart(chunk) {
        while (true) {
            if (this._msgLenBufs) {
                this._msgLenBufs.push(chunk);

                if (this._msgLenBufLen + chunk.length < 4) {
                    this._msgLenBufLen += chunk.length;
                    break;

                } else {
                    const lenBuffer = Buffer.concat(this._msgLenBufs, 4);

                    this._msgLen    = lenBuffer.readUInt32BE(0);
                    this._msgBufLen = 0;
                    this._msgBufs   = [];

                    this._msgLenBufs = null;

                    const offset = 4 - this._msgLenBufLen;

                    if (offset < chunk.length) {
                        chunk = chunk.slice(offset);
                    } else {
                        break;
                    }
                }

            } else if (this._msgBufs) {
                this._msgBufs.push(chunk);

                if (this._msgLen > this._msgBufLen + chunk.length) {
                    this._msgBufLen += chunk.length;
                    break;

                } else {
                    this._onMessage(Buffer.concat(this._msgBufs, this._msgLen));

                    this._msgBufs = null;

                    const offset = this._msgLen - this._msgBufLen;

                    if (chunk.length > offset) {
                        chunk = chunk.slice(offset);
                    } else {
                        break;
                    }
                }
            } else if (chunk.length < 4) {
                this._msgLenBufs   = [chunk];
                this._msgLenBufLen = chunk.length;
                break;

            } else {
                this._msgLen    = chunk.readUInt32BE(0);
                this._msgBufLen = 0;
                this._msgBufs   = [];

                if (chunk.length > 4) {
                    chunk = chunk.slice(4);
                } else {
                    break;
                }
            }
        }
    }

    _onMessage(buffer) {
        const packet = JSON.parse(buffer.toString('utf-8'));

        if (packet.type === 'request') {
            this._safeRequestHandler(packet.requestName, packet.data).then(result => {
                if (!this._ended) {
                    this._send({
                        type:        'response',
                        responseFor: packet.requestId,
                        data:        result
                    });
                }

            }, err => {
                let error;

                if (typeof err === 'string') {
                    error = err;
                } else {
                    error = 'UNKNOWN';
                    console.error('[JSON-Connection]', err);
                }

                this._send({
                    type:        'response',
                    responseFor: packet.requestId,
                    error:       error
                });
            });

        } else if (packet.type === 'response') {
            const callbacks = this._requests.get(packet.responseFor);

            if (callbacks) {
                this._requests.delete(packet.responseFor);

                if (packet.error) {
                    callbacks.reject(packet.error);
                } else {
                    callbacks.resolve(packet.data);
                }
            }
        } else {
            this.emit('message', packet.data);
        }
    }

    _safeRequestHandler(requestName, data) {
        if (!this._requestHandler) {
            const err = new Connection.NoRequestHandlerError();
            this.emit('error', err);
            return Promise.reject(err);
        }

        try {
            return Promise.resolve(this._requestHandler(requestName, data));
        } catch(err) {
            this.emit('error', err);
            return Promise.reject(err);
        }
    }
}

Connection.ConnectionError = class ConnectionError extends Error {
    constructor(msg) {
        super(msg);
        Error.captureStackTrace(this, this.constructor);
    }
};

Connection.SocketCloseError = class SocketCloseError extends Error {
    constructor() {
        super('Socket closed');
    }
};

Connection.NoRequestHandlerError = class NoRequestHandlerError extends Error {
    constructor(err) {
        super('No request handler');
    }
};


module.exports = Connection;
