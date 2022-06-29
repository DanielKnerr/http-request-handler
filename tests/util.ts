import { Options, HTTPRequestHandler } from "../src/HTTPRequestHandler";
import * as http from "http";

export function setupServer(opts?: Partial<Options>): Promise<{ handler: HTTPRequestHandler, server: http.Server }> {
    const handler = new HTTPRequestHandler(opts);
    const server = http.createServer(handler.getListener());
    let port = 3000;

    return new Promise((resolve) => {
        server.on("listening", () => {
            resolve({ handler: handler, server: server });
        });

        const tryStart = () => {
            server.listen(port);
            server.on("error", (e: NodeJS.ErrnoException) => {
                if (e.code === "EADDRINUSE") {
                    server.close();
                    port++;
                    tryStart();
                }
            });
        };
        tryStart();
    });
}

export function cleanupServer(server: http.Server) {
    server.close();
}