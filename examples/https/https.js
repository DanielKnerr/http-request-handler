/* eslint-disable @typescript-eslint/no-var-requires */
const {HTTPRequestHandler, HttpMethod} = require("http-request-handler");
const http = require("http");
const https = require("https");
const fs = require("fs");

const httpsOptions = {
    key: fs.readFileSync("keyFile.pem"),
    cert: fs.readFileSync("certFile.pem")
};

let handler = new HTTPRequestHandler({
    endpoint: "/myapi"
});

handler.on(HttpMethod.HTTP_GET, "/hello", [], (request, response) => {
    response.send("world");
});

https.createServer(httpsOptions, handler.getListener()).listen(3443);

// use HTTPRequestHandler.redirectToHTTPS to redirect all traffic to HTTPS
http.createServer(handler.redirectToHTTPS()).listen(3000);