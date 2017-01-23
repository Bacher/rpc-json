const Server = require('./Server');

class RequestServer extends Server {

    /**
     * @param {Function} requestHandler - callback for handle requests
     */
    constructor(requestHandler) {
        super({
            requestHandler,
            redirectErrors: true
        });
    }
}

module.exports = RequestServer;

