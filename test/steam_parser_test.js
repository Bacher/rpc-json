const fs = require('fs');
const Connection = require('../Connection');

const testConn = {
    packCount: 0,
    _processPart: Connection.prototype._processPart,
    _onMessage(chunk) {
        try {
            console.log('PARSE OK', JSON.parse(chunk));
            this.packCount++;
        } catch(err) {
            console.log(chunk.toString('utf-8'));
            console.warn(err);
        }
    }
};

const CHUNK_LEN = 3;

fs.readFile('msg', (err, buffer) => {
    if (err) {
        console.error(err);
        return;
    }

    for (let start = 0; start < buffer.length; ) {
        //const len = CHUNK_LEN;
        const len = 1 + Math.floor(Math.random() * 3);
        console.log(`_processPart bytes: ${len}`);
        testConn._processPart(buffer.slice(start, Math.min(start + len, buffer.length)));

        start += len;
    }

    if (testConn.packCount !== 3) {
        throw new Error('Must be 3 packages');
    }
});
