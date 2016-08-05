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

        this._packetId = 0;
        this._requestId = 0;

        this._ended = false;

        this._msgLen = 0;
        this._msgBufLen = 0;
        this._msgBufs = null;

        this._requests = new Map();

        this._bindEvents(this._socket);
    }

    _bindEvents() {
        this._socket
            .on('error', this._onError.bind(this))
            .on('end',   this._onEnd.bind(this))
            .on('close', this._onClose.bind(this))
            .on('data',  this._onSocketData.bind(this));
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
        const error = new Error('SOCKET_CLOSED');

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
            this._send({
                type:        'request',
                requestId:   ++this._requestId,
                requestName: name,
                data:        data
            });

            this._requests.set(this._requestId, { resolve, reject });
        })
    }

    destroy() {
        this._socket.destroy();
    }

    _send(data) {
        if (this._ended) {
            throw new Error('SOCKET_CLOSED');
        }

        data.packetId = ++this._packetId;

        const buf = new Buffer(JSON.stringify(data));

        const preamble = new Buffer(6);
        preamble.writeUInt8(254, 0);
        preamble.writeUInt8(9, 1);
        preamble.writeUInt32BE(buf.length, 2);

        this._socket.write(preamble);
        this._socket.write(buf);
    }

    _onSocketData(chunk) {
        this._processPart(chunk);
    }

    _processPart(chunk) {
        if (this._msgLenBuf) {
            const lenBuffer = new Buffer(6);
            this._msgLenBuf.copy(lenBuffer);
            chunk.copy(lenBuffer, this._msgLenBuf.length, 0, 6 - this._msgLenBuf.length);

            if (chunk.readUInt8(0) !== 254 || chunk.readUInt8(1) !== 9) {
                throw new Error('Protocol sync failed');
            }
            this._msgLen = lenBuffer.readUInt32BE(2);
            this._msgBufLen = 0;
            this._msgBufs = [];

            this._msgLenBuf = null;

            this._processPart(chunk.slice(6 - this._msgLenBuf.length));
            return;
        }

        if (this._msgBufs) {
            this._msgBufs.push(chunk);

            if (this._msgLen > this._msgBufLen + chunk.length) {
                this._msgBufLen += chunk.length;

            } else {
                this._onMessage(Buffer.concat(this._msgBufs, this._msgLen));

                this._msgBufs = null;

                const offset = this._msgLen - this._msgBufLen;

                const bytesLeftCount = chunk.length - offset;

                if (bytesLeftCount) {
                    if (bytesLeftCount >= 6) {
                        if (chunk.readUInt8(offset) !== 254 || chunk.readUInt8(offset + 1) !== 9) {
                            throw new Error('Protocol sync failed');
                        }

                        this._msgLen = chunk.readUInt32BE(offset + 2);
                        this._msgBufs = [];
                        this._msgBufLen = 0;

                        if (bytesLeftCount > 6) {
                            this._processPart(chunk.slice(offset + 6));
                        }

                    } else {
                        this._msgLenBuf = chunk.slice(offset);
                    }
                }
            }
        } else {
            if (chunk.readUInt8(0) !== 254 || chunk.readUInt8(1) !== 9) {
                console.error('Protocol sync failed');
                throw new Error('Protocol sync failed');
            }

            this._msgLen = chunk.readUInt32BE(2);
            this._msgBufLen = 0;
            this._msgBufs = [];

            this._processPart(chunk.slice(6));
        }
    }

    _onMessage(buffer) {
        const packet = JSON.parse(buffer.toString('utf-8'));

        if (packet.type === 'request') {
            this._requestHandler(packet.requestName, packet.data, response => {
                this._send({
                    type: 'response',
                    responseFor: packet.requestId,
                    data: response
                });
            });
        } else if (packet.type === 'response') {
            const callbacks = this._requests.get(packet.responseFor);

            if (callbacks) {
                this._requests.delete(packet.responseFor);
                callbacks.resolve(packet.data);
            }
        } else {
            this.emit('message', packet.data);
        }
    }
}

module.exports = Connection;
