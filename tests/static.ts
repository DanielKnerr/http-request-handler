import { HttpMethod, HTTPRequestHandler } from "../src/HTTPRequestHandler";
import http from "http";
import { cleanupServer, setupServer } from "./util";
import request from "supertest";
import fs from "fs";

let server: http.Server;
let handler: HTTPRequestHandler;
beforeAll(async () => {
    const ret = await setupServer({endpoint: "/api"});
    handler = ret.handler;
    server = ret.server;

    handler.on(HttpMethod.HTTP_GET, "/test", [], (request, response) => {
        response.send("test");
    });

    handler.mountStaticFolder("/staticFolder", [], "tests/data");
    handler.mountStaticFile("/staticFile", [], "tests/data/test.jpg");

});

it("can differentiate static routes from normal routes", (done) => {
    request(server).get("/api/test").expect("test", done);
});

it("can serve files from a static folder", async () => {
    const file = fs.readFileSync("tests/data/test.jpg");
    const response = await request(server).get("/staticFolder/test.jpg");

    expect(response.headers["content-type"] === "image/jpeg;").toBe(true);
    expect(response.body.toString()).toEqual(file.toString());
});

it("can serve static files", async () => {
    const file = fs.readFileSync("tests/data/test.jpg");
    const response = await request(server).get("/staticFile");

    expect(response.headers["content-type"] === "image/jpeg;").toBe(true);
    expect(response.body.toString()).toEqual(file.toString());
});

it("does not allow invalid static path", () => {
    const spy = jest.spyOn(console, "log");
    handler.mountStaticFolder("/api/path", [], "tests/data");
    expect(spy).toHaveBeenCalledWith(expect.stringContaining("collides with"));
});


afterAll(() => cleanupServer(server));