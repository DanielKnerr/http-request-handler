import * as http from "http";
import { Response } from "./Response";
import { doURLsMatch } from "./RouteMatcher";
import { logError } from "./util";
import mime from "mime-types";
import fs from "fs";
import path from "path";
import * as pug from "pug";
export * from "./MiddlewareFunctions";

/**
 * @inheritdoc
 */
export type StringObject = {
    [key: string]: string
};

/**
 * Represents an incoming request from a client.
 * - `url` The requested url. Does not include the host.
 * - `method` The requested HTTP-method
 * - `urlParameters` This object contains all declared route path parameters and their value.
 * - `headers` This object contains all headers from the current request as keys. The value is either a string or a string-array.
 * - `cookies` This object contains all cookies from the current request as keys-value pairs.
 * - `body` The body of the request, represented as a string.
 */
export type Request = {
    url: string,
    method: HttpMethod,
    // the user is not allowed to define multiple urlParameters with the same name
    urlParameters: StringObject,
    // the ?key1=value1&key2=value2 pairs in the URL
    urlArguments: StringObject,
    // there can be multiple headers with the same name (sent as an array)
    headers: StringObject,
    // there will never be multiple cookies with the same name, the browser chooses only one cookie
    cookies: StringObject,
    body: string
};

type DataObject = {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [key: string]: any
};

/**
 * A middleware function. Must call resolve, reject or send a response using the `response` parameter.
 * @param request The current request
 * @param response The current response
 * @param data The accumulated data from the previous middleware functions or an empty object if this is the first middleware function for the route.
 * @param resolve: A function to accept this request. If an object is supplied, then this will be merged with the data from the previous middleware function and supplied to the next middleware function. 
 * @param reject: A function to reject this request. If an error code is supplied, then this code will be used for the HTTP-Response.
 */
export type MiddlewareFunction = (request: Request, response: Response, data: DataObject, resolve: (value?: DataObject) => void, reject: (errorCode?: number) => void) => void;

/**
 * A function to handle an incoming request for a route.
 * @param request The current request.
 * @param response An object to construct and send the response.
 * @param data The accumulated data from all middleware functions of the current route.
 */
export type HandlerFunction = (request: Request, response: Response, data: DataObject) => void;

/**
 * HTTP-methods represented as an enum
 */
export enum HttpMethod { HTTP_GET, HTTP_HEAD, HTTP_POST, HTTP_PUT, HTTP_DELETE, HTTP_CONNECT, HTTP_OPTIONS, HTTP_TRACE, HTTP_PATCH }

/**
 * @ignore
 */
function decodeMethod(str: string): HttpMethod {
    if (str === "GET") return HttpMethod.HTTP_GET;
    if (str === "HEAD") return HttpMethod.HTTP_HEAD;
    if (str === "POST") return HttpMethod.HTTP_POST;
    if (str === "PUT") return HttpMethod.HTTP_PUT;
    if (str === "DELETE") return HttpMethod.HTTP_DELETE;
    if (str === "CONNECT") return HttpMethod.HTTP_CONNECT;
    if (str === "OPTIONS") return HttpMethod.HTTP_OPTIONS;
    if (str === "TRACE") return HttpMethod.HTTP_TRACE;
    return HttpMethod.HTTP_PATCH;
}

// additional options:
// - log errors
// - log request (with time and IP)
/**
 * Represents all user-definable options.
 * - `endpoint`: The endpoint of the routes. All route paths are interpreted as relative to the endpoint.
 */
export type Options = {
    endpoint: string
};

enum RouteType { STATIC_FOLDER, STATIC_FILE, HANDLER }

type Route = {
    method: HttpMethod, path: string,
    middleware: MiddlewareFunction[], handler: HandlerFunction,
    type: RouteType
};

export class HTTPRequestHandler {
    /**
     * @ignore
     */
    #options: Options = {
        endpoint: "/"
    };
    /**
     * @ignore
     */
    #routeMapping: Route[] = [];
    /**
     * @ignore
     */
    #globalMiddlewareFunctions: MiddlewareFunction[] = [];

    #pugTemplateMap: Map<string, pug.compileTemplate> = new Map();

    constructor(options?: Partial<Options>) {
        if (typeof options === "object") {
            // merge options
            for (const key in options) {
                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                // @ts-ignore
                this.#options[key] = options[key];
            }

            if (options.endpoint !== undefined) {
                let errorMessage = "";
                if (options.endpoint[0] !== "/") errorMessage = "Endpoint has to start with '/'";
                if (options.endpoint.slice(-1) === "/") errorMessage = "Endpoint has to end without a '/'";

                if (errorMessage !== "") {
                    logError(errorMessage);
                    throw new Error(errorMessage);
                }
            }
        }
    }

    /**
     * @ignore
     */
    #parseCookies(text: string | string[] | undefined): StringObject {
        if (typeof text === "string") {
            const obj: StringObject = {};

            const tokens = text.split(";");
            tokens.forEach((token) => {
                const idx = token.indexOf("=");
                if (idx >= 1) {
                    const key = token.substring(0, idx).trim();
                    const value = token.substring(idx + 1).trimStart();

                    obj[key] = value;
                }
            });

            return obj;
        } else {
            return {};
        }
    }

    /**
     * @ignore
     */
    #getBody(httpRequest: http.IncomingMessage): Promise<string> {
        return new Promise((resolve) => {
            let body = "";
            httpRequest.on("data", (chunk) => {
                body += chunk;
            });
            httpRequest.on("end", () => {
                resolve(body);
            });
        });
    }


    #splitURL(url: string): {url: string, arguments: StringObject} {
        let ret: StringObject = {};
        let s = url.split("?");
        let baseURL = s[0];
        if (s.length > 1 && s[1].length > 1) {
            s.shift();
            let a = s.join("?");
            let b = a.split("&");
            b.forEach((v) => {
                let [key, value] = v.split("=");
                if (key !== undefined) {
                    ret[key] = value !== undefined ? value : "";
                }
            });
        }

        return {
            url: baseURL,
            arguments: ret
        };
    }

    /**
     * @ignore
     */
    async #executeMatchingRoutes(httpRequest: http.IncomingMessage, httpResponse: http.ServerResponse) {
        const response = new Response(httpResponse, this.#pugTemplateMap);

        if (httpRequest.url && httpRequest.method) {
            let found = false;
            let matchedPath = "";

            if (httpRequest.url.indexOf(this.#options.endpoint) === 0) {
                let urlWithoutEndpoint = httpRequest.url.substring(this.#options.endpoint.length);

                let {url: baseURL, arguments: urlArguments} = this.#splitURL(urlWithoutEndpoint);

                for (const route of this.#routeMapping) {
                    if (route.type !== RouteType.HANDLER) {
                        continue;
                    }

                    const urlMatch = doURLsMatch(baseURL, route.path);

                    if (urlMatch.match) {
                        if (found) {
                            logError("The URL '" + httpRequest.url + "' was already matched to '" + matchedPath + "', but '" + route.path + "' is also a match");
                        } else {
                            found = true;
                            matchedPath = route.path;

                            const headers: StringObject = {};
                            for (const key in httpRequest.headers) {
                                // all headers except Set-Cookie should be strings
                                if (Array.isArray(httpRequest.headers[key])) {
                                    headers[key] = (httpRequest.headers[key] as string[]).join(", ");
                                } else {
                                    headers[key] = httpRequest.headers[key] as string;
                                }
                            }

                            const body = await this.#getBody(httpRequest);

                            const request: Request = {
                                url: httpRequest.url,
                                urlParameters: urlMatch.urlParameters,
                                urlArguments: urlArguments,
                                method: decodeMethod(httpRequest.method),
                                headers: headers,
                                cookies: this.#parseCookies(headers.cookie),
                                body: body
                            };

                            const data: DataObject = {};

                            try {
                                // Global middleware functions
                                for (const func of this.#globalMiddlewareFunctions) {
                                    const returnedData = await (new Promise((resolve: (data?: DataObject) => void, reject: (errorCode?: number) => void) => {
                                        response.setSendCallback(() => reject(-1));
                                        func(request, response, data, resolve, reject);
                                    }));

                                    response.unsetSendCallback();

                                    // merge the returned data into the data object, such that the next middleware function can access it as well
                                    if (typeof returnedData === "object") {
                                        for (const key in returnedData) {
                                            data[key] = returnedData[key];
                                        }
                                    }
                                }

                                // Middleware functions of the route
                                for (const func of route.middleware) {
                                    // there are three ways a middleware function can end:
                                    //  - a call to resolve
                                    //  - a call to reject
                                    //  - using the Response object
                                    // resolve and reject will end this promise, so this function can finish
                                    // a call to Response inside a middleware must also end the Promise 
                                    const returnedData = await (new Promise((resolve: (data?: DataObject) => void, reject: (errorCode?: number) => void) => {
                                        response.setSendCallback(() => reject(-1));
                                        func(request, response, data, resolve, reject);
                                    }));

                                    response.unsetSendCallback();

                                    // merge the returned data into the data object, such that the next middleware function can access it as well
                                    if (typeof returnedData === "object") {
                                        for (const key in returnedData) {
                                            data[key] = returnedData[key];
                                        }
                                    }
                                }

                                try {
                                    route.handler(request, response, data);
                                } catch (e) {
                                    logError("An error occured when executing the handler for route '" + route.path + "'");
                                    response.error(500);
                                }
                            } catch (errorCode) {
                                if (typeof errorCode === "number") {
                                    if (errorCode === -1) {
                                        // a middleware function has called Response.send(), don't do anything
                                    } else {
                                        response.error(errorCode);
                                    }
                                } else {
                                    logError("An error occured when executing a middleware function for route '" + route.path + "'");
                                    console.log(errorCode);

                                    response.error(500);
                                }
                            }
                        }
                    }
                }
            }
            
            if (this.#options.endpoint === "/" || (this.#options.endpoint !== "/" && httpRequest.url.indexOf(this.#options.endpoint) !== 0)) {
                
                // the requested url does not start with the endpoint, does it match a static route?
                for (const route of this.#routeMapping) {
                    if (route.type === RouteType.STATIC_FOLDER) {
                        if (httpRequest.url.indexOf(route.path) === 0) {
                            const request: Request = {
                                body: "",
                                cookies: {},
                                headers: {},
                                method: 0,
                                url: httpRequest.url,
                                urlParameters: {},
                                urlArguments: {}
                            };
                            route.handler(request, response, {});
                            found = true;
                            break;
                        }
                    } else if (route.type === RouteType.STATIC_FILE) {
                        const requestPath = httpRequest.url.endsWith("/") ? httpRequest.url.slice(0, -1) : httpRequest.url;
                        const routePath = route.path.endsWith("/") ? route.path.slice(0, -1) : route.path;

                        if (requestPath === routePath) {
                            const request: Request = {
                                body: "",
                                cookies: {},
                                headers: {},
                                method: 0,
                                url: "",
                                urlParameters: {},
                                urlArguments: {}
                            };
                            route.handler(request, response, {});
                            found = true;
                            break;
                        }
                    }
                }
            }

            if (!found) {
                response.error(404);
            }
        } else {
            response.error(500);
        }

    }

    #loadPugTemplatesWithPrefix(folder: fs.PathLike, prefix: string) {
        fs.readdirSync(folder).forEach(file => {
            let fullPath = path.join(folder.toString(), file);
            if (fs.lstatSync(fullPath).isDirectory()) {
                this.#loadPugTemplatesWithPrefix(fullPath, prefix + file + "/");
            } else {
                let templateName = path.parse(file).name;
                this.#pugTemplateMap.set(prefix + templateName, pug.compileFile(fullPath));
            }
        });
    }

    loadPugTemplates(folder: string) {
        this.#loadPugTemplatesWithPrefix(folder, "");
        console.log(this.#pugTemplateMap.keys());
    }

    /**
     * This function returns a listener function that can be used with `http.createServer`.
     */
    getListener(): http.RequestListener {
        return async (httpRequest: http.IncomingMessage, httpResponse: http.ServerResponse) => {
            this.#executeMatchingRoutes(httpRequest, httpResponse);
        };
    }

    /**
     * This function returns a listener function that redirects all traffic to HTTPS.
     */
    redirectToHTTPS(): http.RequestListener {
        return async (httpRequest: http.IncomingMessage, httpResponse: http.ServerResponse) => {
            // see https://stackoverflow.com/a/29688575/17278981
            httpResponse.writeHead(301, {
                "Location": "https://" + httpRequest.headers.host + httpRequest.url
            });
            httpResponse.end();
        };
    }

    /**
     * This function declares a route.
     * @param method What HTTP-method this route is for
     * @param path The path of route, relative to the endpoint. If no endpoint has been defined the path is relative to "/". The path may contain url parameters such as "/path/:param". Paramater names must not repeat. They can be accessed in `Request.urlParameters`.
     * @param middlewareFunctions An array of middleware functions. They will be executed in the order they are listed.
     * @param handler The handler function
     */
    on(method: HttpMethod, path: string, middlewareFunctions: MiddlewareFunction[], handler: HandlerFunction): void {
        const parts = path.split("/");
        const usedParameterNames = [];
        for (const t of parts) {
            if (t.startsWith(":")) {
                const name = t.substring(1);
                if (usedParameterNames.indexOf(name) === -1) usedParameterNames.push(name);
                else {
                    logError("Can't add route for path '" + path + "' because parameter names repeat.");
                    return;
                }
            }
        }

        if (path[0] === "/") {
            this.#routeMapping.push({ method, path, middleware: middlewareFunctions, handler, type: RouteType.HANDLER });
        } else {
            this.#routeMapping.push({ method, path: "/" + path, middleware: middlewareFunctions, handler, type: RouteType.HANDLER });
        }
    }

    #doesPathConflictWithEndpoint(url: string): boolean {
        // make sure that the url does not start with the endpoint
        const endpointParts = this.#options.endpoint.split("/");
        const urlParts = url.split("/");

        // the endpoint always starts with a slash, so the first element is an empty string
        endpointParts.shift();
        if (url.startsWith("/")) urlParts.shift();

        let matchesEndpoint = false;
        for (let i = 0; i < endpointParts.length; i++) {
            if (!(urlParts[i] === undefined || endpointParts[i] != urlParts[i])) {
                matchesEndpoint = true;
                break;
            }
        }
        return matchesEndpoint;
    }

    /**
     * This function will make the a file available under a specified url.
     * The api-endpoint specified in the options will be ignored.
     * @param url under what url the file will be available. Must be different from the endpoint specified in the options.
     * @param middlewareFunctions
     * @param filePath path to the file
     */
    mountStaticFile(url: string, middlewareFunctions: MiddlewareFunction[], filePath: string): void {
        const matchesEndpoint = this.#doesPathConflictWithEndpoint(url);
        if (matchesEndpoint) {
            logError(`The requested static path '${url}' collides with the api endpoint '${this.#options.endpoint}'`);
            return;
        } else {
            this.#routeMapping.push({
                method: HttpMethod.HTTP_GET, path: url, middleware: middlewareFunctions, type: RouteType.STATIC_FILE,
                handler: (request, response) => {
                    fs.readFile(filePath, (err, buffer) => {
                        const mimeType = mime.lookup(filePath) || "application/octet-stream";
                        response.send(buffer, {contentType: mimeType});
                    });
                }
            });
        }
    }

    /**
     * This function will make the contents of a folder available under a specified url endpoint.
     * The api-endpoint specified in the options will be ignored.
     * @param url under what url the contents of the folder will be available. Must be different from the endpoint specified in the options.
     * @param middlewareFunctions
     * @param folderPath path to the folder
     */
    mountStaticFolder(url: string, middlewareFunctions: MiddlewareFunction[], folderPath: string): void {
        const matchesEndpoint = this.#doesPathConflictWithEndpoint(url);
        if (matchesEndpoint) {
            logError(`The requested static path '${url}' collides with the api endpoint '${this.#options.endpoint}'`);
            return;
        } else {
            this.#routeMapping.push({
                method: HttpMethod.HTTP_GET, path: url, middleware: middlewareFunctions, type: RouteType.STATIC_FOLDER,
                handler: (request, response) => {
                    const file = request.url.substring(url.length);

                    let filePath = path.join(folderPath, file);
                    if (file === "" || file === "/") {
                        if (fs.existsSync(filePath)) {
                            filePath = path.join(folderPath, "index.html");
                        }
                    }

                    fs.readFile(filePath, (err, buffer) => {
                        const mimeType = mime.lookup(filePath) || "application/octet-stream";
                        response.send(buffer, {contentType: mimeType});
                    });
                }
            });
        }
    }

    registerGlobalMiddlewareFunction(func: MiddlewareFunction) {
        this.#globalMiddlewareFunctions.push(func);
    }
}