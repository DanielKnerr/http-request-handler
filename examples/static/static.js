/* eslint-disable @typescript-eslint/no-var-requires */
// const {HTTPRequestHandler, HttpMethod} = require("../../dist/HTTPRequestHandler");
const {HTTPRequestHandler, HttpMethod} = require("http-request-handler");
const http = require("http");

const handler = new HTTPRequestHandler({
    endpoint: "/api"
});

handler.on(HttpMethod.HTTP_GET, "/test", [], (request, response) => {
    response.send("test");
});

handler.mountStaticFolder("/staticFolder", [], "folder");
handler.mountStaticFile("/test", [], "folder/test.jpg");

http.createServer(handler.getListener()).listen(3000);
