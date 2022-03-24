import { HttpMethod } from "../src/HTTPRequestHandler";
import http from "http";
import { cleanupServer, setupServer } from "./util";
import request from "supertest";

let server: http.Server;
beforeAll(async () => {
    const ret = await setupServer();
    const handler = ret.handler;
    server = ret.server;

    handler.on(HttpMethod.HTTP_GET, "/cookieTest1", [], (request, response) => {
        response.setCookie("a", "b");
        response.setCookie("c", "d");
        response.send("");
    });

    handler.on(HttpMethod.HTTP_GET, "/cookieTest2", [], (request, response) => {
        response.setCookie("a=", "value");
        response.setCookie("b", "value;");
        response.send("");
    });

    handler.on(HttpMethod.HTTP_GET, "/cookieTest3", [], (request, response) => {
        response.setCookie("a", "b", {
            Domain: "domain",
            HttpOnly: true,
            Secure: true,
            SameSite: "Lax",
            Expires: new Date("1.2.2033"),
            MaxAge: 999,
            Path: "/test"
        });
        response.setCookie("c", "d", {
            Secure: true,
            HttpOnly: false
        });
        response.send("");
    });

    handler.on(HttpMethod.HTTP_GET, "/cookieTest4", [], (request, response) => {
        response.send(request.cookies.a + request.cookies.c);
    });
});

it("can set cookies", async () => {
    const response = await request(server).get("/cookieTest1");
    expect(response.headers["set-cookie"][0] === "a=b;").toBe(true);
    expect(response.headers["set-cookie"][1] === "c=d;").toBe(true);
});

it("won't set incorrect cookies", async () => {
    const response = await request(server).get("/cookieTest2");
    
    expect(response.headers["set-cookie"] === undefined).toBe(true);
});

it("can set cookie options", async () => {
    const response = await request(server).get("/cookieTest3");

    expect(response.headers["set-cookie"][0] ===
        "a=b; Expires=Sat, 01 Jan 2033 23:00:00 GMT; Max-Age=999; Domain=domain; Path=/test; Secure; HttpOnly; SameSite=Lax;"
    ).toBe(true);
    expect(response.headers["set-cookie"][1] === "c=d; Secure;").toBe(true);
});

it("can parse cookies", async () => {
    const response = await request(server).get("/cookieTest4").set("Cookie", ["a=b; c=d;"]);
    expect(response.text).toBe("bd");
});

// it("can set cookies", (done) => {
//     request(server).get("/responseTest1")
//         .set("Cookie", ["key1=value1; key2=value2;key3=value3;   key4  =  value4; key5=value5=5;invalid;;key6=value6"])
//         .expect("", done);
// });

afterAll(() => cleanupServer(server));