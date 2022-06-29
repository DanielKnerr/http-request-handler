import * as http from "http";
import { cleanupServer, setupServer } from "./util";
import request from "supertest";
import { HttpMethod, MiddlewareFunction } from "../src/HTTPRequestHandler";
import { CORSMiddleware } from "../src/MiddlewareFunctions";

let server: http.Server;
beforeAll(async () => {
    const ret = await setupServer();
    const handler = ret.handler;
    server = ret.server;

    const testMiddlewareA: MiddlewareFunction = (request, response, data, resolve) => {
        resolve({ a: 1 });
    };
    const testMiddlewareB: MiddlewareFunction = (request, response, data, resolve) => {
        resolve({ b: data.a });
    };

    handler.on(HttpMethod.HTTP_GET, "/middlewareDataTest", [testMiddlewareA, testMiddlewareB], (request, response, data) => {
        response.send(data.b);
    });


    const testMiddlewareC: MiddlewareFunction = (request, response, data, resolve, reject) => {
        reject(418);
    };

    handler.on(HttpMethod.HTTP_GET, "/middlewareRejectTest", [testMiddlewareC], (request, response) => {
        response.send("");
    });


    const testMiddlewareD: MiddlewareFunction = (request, response) => {
        if (request.method === HttpMethod.HTTP_POST) response.send("post");
        else response.send("not post");
    };

    handler.on(HttpMethod.HTTP_GET, "/middlewareMethodTest", [testMiddlewareD], (request, response) => {
        response.send("");
    });

    const testMiddlewareE: MiddlewareFunction = (request, response, data, resolve) => {
        resolve();
    };

    handler.on(HttpMethod.HTTP_GET, "/middlewareResolveTest", [testMiddlewareE], (request, response) => {
        response.send("ok");
    });

    handler.on(HttpMethod.HTTP_GET, "/middlewareCORStest", [CORSMiddleware], (request, response) => {
        response.send("ok");
    });
});

it("forwards data through successive middleware functions", (done) => {
    request(server).get("/middlewareDataTest").expect("1", done);
});

it("can reject a request", (done) => {
    request(server).get("/middlewareRejectTest").expect(418, done);
});

it("can determine HTTP method", (done) => {
    // TODO: i don't think this works
    // TODO: check all tests for this mistake
    request(server).post("/middlewareMethodTest").expect("post", done);
    request(server).get("/middlewareMethodTest").expect("not post", done);
});

it("can resolve", (done) => {
    request(server).get("/middlewareResolveTest").expect("ok", done);
});

it("the CORS middleware works correctly", async () => {
    const response = await request(server).get("/middlewareCORStest").set({
        "Origin": "http://localhost:3000",
        "Access-Control-Request-Headers": "csrf",
        "Access-Control-Request-Method": "GET"
    });

    expect(response.headers["access-control-allow-origin"]).toBe("http://localhost:3000");
    expect(response.headers["access-control-allow-headers"]).toBe("csrf");
    expect(response.headers["access-control-allow-method"]).toBe("GET");
});

afterAll(() => cleanupServer(server));