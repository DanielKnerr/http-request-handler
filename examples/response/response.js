/* eslint-disable @typescript-eslint/no-var-requires */
const {HTTPRequestHandler, HttpMethod} = require("http-request-handler");
const http = require("http");
const fs = require("fs");

const a = new HTTPRequestHandler({
    endpoint: "/api"
});

a.on(HttpMethod.HTTP_GET, "/cookieTest", [], (request, response, data) => {
    console.log(request.cookies);
    response.setCookie("hello", "test");
    response.setCookie("a", "sus", {
        Path: "/sus",
        MaxAge: 93932
    });
    
    response.send("ok");
});

a.on(HttpMethod.HTTP_GET, "/imgTest", [], (request, response, data) => {
    const file = fs.readFileSync("examples/response/test.jpg");
    response.send(file);
});

http.createServer(a.getListener()).listen(3000);
