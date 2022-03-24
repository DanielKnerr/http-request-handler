/* eslint-disable @typescript-eslint/no-var-requires */
const {HTTPRequestHandler, HttpMethod} = require("http-request-handler");
const http = require("http");

const handler = new HTTPRequestHandler({
    endpoint: "/api"
});

// this route matches:
//  - /api/wildcard/
//  - /api/wildcard/hello
//  - /api/wildcard/hello/world
//  - ...
handler.on(HttpMethod.HTTP_GET, "/wildcard/*", [], (request, response, data) => {
    response.send("heyo bruv!");
});

// this route matches only /api/hello
handler.on(HttpMethod.HTTP_GET, "/hello", [], (request, response, data) => {

});

// this route matches only /api/hello/world
handler.on(HttpMethod.HTTP_GET, "/hello/world", [], (request, response, data) => {

});

// this route matches:
//  - /api/oneParam/hello
//  - /api/oneParam/world
//  - ...
handler.on(HttpMethod.HTTP_GET, "/oneParam/:a", [], (request, response, data) => {

});

http.createServer(handler.getListener()).listen(3000);
