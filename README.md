# `http-request-handler`
`http-request-handler` is a tiny library for parsing and handling HTTP-requests in `Node.js`.

## Installation
`npm install http-request-handler`

## Usage
### Basics
Create a new `HTTPRequestHandler` object, declare your routes and then use the `getListener()` function to start the server:
```js
const {HTTPRequestHandler, HttpMethod} = require("http-request-handler");
const http = require("http");

let handler = new HTTPRequestHandler({
    endpoint: "/myapi"
});

handler.on(HttpMethod.HTTP_GET, "/hello", [], (request, response) => {
    response.send("world");
});

http.createServer(handler.getListener()).listen(3000);

// visit http://localhost:3000/myapi/hello
```

### Middleware
Middleware functions can preprocess requests (for example by attaching custom data) before they are passed on to the route handler. They can also reject or respond to requests. The middleware functions of a route will be executed in the order they are listed until a middleware function sends a response, in which case neither the remaining middleware functions or the route handler will be called.
```js

// This middleware function rejects all requests that don't have a valid "token" cookie.
const isUserLoggedIn = (request, response, data, resolve, reject) => {
    let valid = checkCookie(request.cookies.token);

    // allow this request to be passed to the next middleware function
    if (valid) resolve(); 
    else reject(403); // 403 Forbidden
};

// This middleware function assumes that the "token" cookie is valid. It will attach a "userID" property to the data object containing the ID of the logged in user.
const getUserID = (request, response, data, resolve, reject) => {
    let userID = getUserID(request.cookies.token);
    resolve({
        userID: userID
    });
};

handler.on(HttpMethod.HTTP_POST, "/upload", [isUserLoggedIn, getUserID], (request, response, data) => {
    // => this request comes from a logged in user with the ID data.userID
});
```

### HTTPS
Since `http-request-handler` isn't a server, you can setup HTTPS the default way:
```js
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
```

## Development
- to run the tests run `npm test`
- to compile TypeScript to JavaScript run `npm run prepublish`