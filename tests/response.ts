import { HttpMethod, MiddlewareFunction } from "../src/HTTPRequestHandler";
import * as http from "http";
import { cleanupServer, setupServer } from "./util";
import request from "supertest";
import fs from "fs";

let server: http.Server;
beforeAll(async () => {
    const ret = await setupServer();
    const handler = ret.handler;
    server = ret.server;

    handler.on(HttpMethod.HTTP_GET, "/responseTest1", [], (request, response) => {
        response.send("string");
    });

    handler.on(HttpMethod.HTTP_GET, "/responseTest2", [], (request, response) => {
        response.send(42);
    });

    handler.on(HttpMethod.HTTP_GET, "/responseTest3", [], (request, response) => {
        response.send(true);
    });

    handler.on(HttpMethod.HTTP_GET, "/responseTest4", [], (request, response) => {
        response.send({a: 1});
    });

    handler.on(HttpMethod.HTTP_GET, "/responseTest5", [], (request, response) => {
        response.send();
    });

    handler.on(HttpMethod.HTTP_GET, "/responseTest6", [], (request, response) => {
        response.send("a");
        response.send("b");
    });

    handler.on(HttpMethod.HTTP_GET, "/responseTest7", [], (request, response) => {
        const file = fs.readFileSync("tests/data/test.jpg");
        
        response.send(file, "image/jpeg");
    });

    handler.on(HttpMethod.HTTP_GET, "/responseTest8", [], (request, response) => {
        const file = fs.readFileSync("tests/data/test.jpg");
        
        response.send(file);
    });

    handler.on(HttpMethod.HTTP_GET, "/responseTest9", [], (request, response) => {
        response.setHeader("test1", ["value1", "value2"]);
        response.setHeader("test2", "value");
        response.setHeader("test3=", "value");
        response.setHeader("test4", "value;");
        response.send("");
    });

    handler.on(HttpMethod.HTTP_GET, "/responseTest10/*", [], (request, response) => {
        response.send("a");
    });
    handler.on(HttpMethod.HTTP_GET, "/responseTest10/:a", [], (request, response) => {
        response.send("");
    });
    handler.on(HttpMethod.HTTP_GET, "/responseTest10/:b", [], (request, response) => {
        response.send("");
    });

    handler.on(HttpMethod.HTTP_POST, "/responseTest11", [], (request, response) => {
        response.send(request.body);
    });

    handler.on(HttpMethod.HTTP_POST, "/responseTest12", [], (request, response) => {
        response.ok();
    });

    const middlewareFunc: MiddlewareFunction = (request, response, data, resolve) => {
        response.send("middleware");
        resolve();
    };

    handler.on(HttpMethod.HTTP_GET, "/responseTest13", [middlewareFunc], (request, response) => {
        response.send("handler");
    });
});

it("can respond with a string", (done) => {
    request(server).get("/responseTest1").expect("string", done);
});

it("can respond with a number", (done) => {
    request(server).get("/responseTest2").expect("42", done);
});

it("can respond with a boolean", (done) => {
    request(server).get("/responseTest3").expect("true", done);
});

it("can respond with a JSON object", async () => {
    const response = await request(server).get("/responseTest4");
    expect(response.headers["content-type"] === "application/json; charset=UTF-8").toBe(true);
    expect(response.body).toStrictEqual({a: 1});
});

it("can handle empty send", (done) => {
    request(server).get("/responseTest5").expect("", done);
});

it("handles double response correctly", (done) => {
    request(server).get("/responseTest6").expect("a", done);
});

it("can send images and set the MIME-type", async () => {
    const file = fs.readFileSync("tests/data/test.jpg");
    const response = await request(server).get("/responseTest7");

    expect(response.headers["content-type"] === "image/jpeg;").toBe(true);
    expect(response.body.toString()).toEqual(file.toString());
});

it("sends an error for buffers without MIME-type", async () => {
    const response = await request(server).get("/responseTest8");

    expect(response.statusCode === 500).toBe(true);
    expect(response.text === "500 Internal Server Error").toBe(true);
});

it("can set headers", async () => {
    const response = await request(server).get("/responseTest9");
    expect(response.headers["test1"] === "value1, value2").toBe(true);
    expect(response.headers["test2"] === "value").toBe(true);
    expect(response.headers["test3="] === undefined).toBe(true);
    expect(response.headers["test4"] === undefined).toBe(true);
});

it("correctly treats duplicate matching routes", (done) => {
    request(server).get("/responseTest10/test").expect("a", done);
});

it("can parse a POST string body", async () => {
    const response = await request(server).post("/responseTest11").send("text");
    expect(response.text === "text").toBe(true);
});

it("can parse a POST JSON body", async () => {
    const response = await request(server).post("/responseTest11").send({a: 1});
    
    expect(response.text === "{\"a\":1}").toBe(true);
});

it("can respond using .ok()", async () => {
    const response = await request(server).get("/responseTest12");
    expect(response.text === "" && response.status === 200).toBe(true);
});

it("does not continue executing when a middleware function calls Reponse.send", async () => {
    const response = await request(server).get("/responseTest13");
    expect(response.text).toBe("middleware");
});

afterAll(() => cleanupServer(server));