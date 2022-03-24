import { HttpMethod, MiddlewareFunction } from "./HTTPRequestHandler";

export const CORSMiddleware: MiddlewareFunction = (request, response, data, resolve) => {
    if (request.headers.origin !== undefined) {
        response.setHeader("Access-Control-Allow-Origin", request.headers.origin);

        const requestHeaders = request.headers["access-control-request-headers"];
        const requestMethod = request.headers["access-control-request-method"];

        if (requestHeaders !== undefined) {
            response.setHeader("Access-Control-Allow-Headers", requestHeaders);
        }

        if (requestHeaders !== undefined) {
            response.setHeader("Access-Control-Allow-Method", requestMethod);
        }

        response.setHeader("Access-Control-Allow-Credentials", "true");

        if (request.method === HttpMethod.HTTP_OPTIONS) {
            response.ok();
        }
    }
    resolve();
};