import { HttpMethod, HTTPRequestHandler } from "../src/HTTPRequestHandler";
import http from "http";
import { cleanupServer, setupServer } from "./util";
import request from "supertest";

let server: http.Server;
let handler: HTTPRequestHandler;

beforeAll(async () => {
    const ret = await setupServer({
        endpoint: "/api"
    });
    handler = ret.handler;
    server = ret.server;

    handler.on(HttpMethod.HTTP_GET, "/routeTest1/:a/:b", [], (request, response) => {
        response.send(request.urlParameters.a + request.urlParameters.b);
    });

    handler.on(HttpMethod.HTTP_GET, "/routeTest2/subURL", [], (request, response) => {
        response.send("");
    });

    handler.on(HttpMethod.HTTP_GET, "/routeTest3/*", [], (request, response) => {
        response.send("");
    });

    handler.on(HttpMethod.HTTP_GET, "/routeTest4", [], (request, response) => {
        response.send("get");
    });
    handler.on(HttpMethod.HTTP_POST, "/routeTest4", [], (request, response) => {
        response.send("post");
    });
    handler.on(HttpMethod.HTTP_PUT, "/routeTest4", [], (request, response) => {
        response.send("put");
    });

    handler.on(HttpMethod.HTTP_GET, "/routeTest5", [], (request, response) => {
        console.log(request.headers);
        
        if (typeof request.headers.key1 === "string" && typeof request.headers.key2 === "string") {
            response.send(request.headers.key1 + ";" + request.headers.key2);
        } else {
            response.ok();
        }
    });

    handler.on(HttpMethod.HTTP_GET, "/routeTest6/:param", [], (request, response) => {
        response.send(request.urlParameters.param);
    });
});

it("can extract route parameters from the URL", (done) => {
    request(server).get("/api/routeTest1/abc/def").expect("abcdef", done);
});

it("can determine basic routing", () => {
    request(server).get("/api/routeTest2/subURL").expect(200);
    request(server).get("/api/routeTest2/").expect(404);
    request(server).get("/api/routeTest3/").expect(200);
    request(server).get("/api/routeTest3/abc").expect(200);
    request(server).get("/api/routeTest3/abc/").expect(200);
    request(server).get("/api/routeTest3/abc/def").expect(200);
});

it("can differentiate by HTTP method", () => {
    request(server).get("/api/routeTest4").expect("get");
    request(server).post("/api/routeTest4").expect("post");
    request(server).put("/api/routeTest4").expect("put");
});

it("responds with 404", (done) => {
    request(server).get("/api/doesNotExist").expect(404, done);
});

it("responds with 404 on wrong endpoint", (done) => {
    request(server).get("/doesNotExist").expect(404, done);
});

it("does not accept multiple parameters of the same name", async () => {
    const spy = jest.spyOn(console, "log");

    handler.on(HttpMethod.HTTP_GET, "/path/:param/:param", [], (request, response) => {
        response.ok();
    });

    expect(spy).toHaveBeenCalledWith(expect.stringContaining("Can't add route"));

    const response = await request(server).get("/path/a/a");
    expect(response.statusCode).toBe(404);
});

it("can parse header values", async () => {
    const response = await request(server).get("/api/routeTest5").set({
        key1: "string",
        key2: ["a", "b"]
    });
    expect(response.text).toBe("string;a, b");
});

it("can parse header values", async () => {
    let response = await request(server).get("/api/routeTest6/a");
    expect(response.text).toBe("a");

    response = await request(server).get("/api/routeTest6/a/");
    expect(response.text).toBe("a");

    // TODO: this should not pass
    response = await request(server).get("/api/routeTest6/a/b");
    expect(response.status).toBe(404);
});

afterAll(() => cleanupServer(server));