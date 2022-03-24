import { HttpMethod, HTTPRequestHandler } from "../src/HTTPRequestHandler";
import { cleanupServer, setupServer } from "./util";
import request from "supertest";

// what if the port is already used?

it("can handle empty options", () => {
    expect(() => new HTTPRequestHandler()).not.toThrow();
});

it("doesn't accept malformed endpoint", () => {
    expect(() =>
        new HTTPRequestHandler({
            endpoint: "api"
        })
    ).toThrow();

    expect(() =>
        new HTTPRequestHandler({
            endpoint: "/api/"
        })
    ).toThrow();
});

it("accepts valid endpoint", () => {
    expect(() => {
        new HTTPRequestHandler({
            endpoint: "/api"
        });
    }).not.toThrow();
});

it("accepts valid endpoint with slashes", async () => {
    const ret = await setupServer({
        endpoint: "/api/test"
    });

    ret.handler.on(HttpMethod.HTTP_GET, "/", [], (request, response) => {
        response.send("ok");
    });

    const response = await request(ret.server).get("/api/test/");
    cleanupServer(ret.server);
    expect(response.text === "ok").toBe(true);
});