import { StringObject } from "./HTTPRequestHandler";

/**
 * @ignore
 */
function trim(url: string): string {
    while (url.endsWith("/")) {
        url = url.substring(0, url.length - 1);
    }

    if (!url.startsWith("/")) {
        url = "/" + url;
    }
    return url;
}

/**
 * @ignore
 */
export function doURLsMatch(request: string, route: string): { match: boolean, urlParameters: StringObject } {
    const returnObject: { match: boolean, urlParameters: StringObject } = {
        match: false,
        urlParameters: {}
    };
    // the URLs start with a slash and end without one
    request = trim(request);
    route = trim(route);

    const requestParts = request.split("/");
    const routeParts = route.split("/");

    // because they both start with a slash the first element will be empty 
    requestParts.shift();
    routeParts.shift();

    for (let idx = 0; idx < routeParts.length; idx++) {
        const part = routeParts[idx];

        if (part === "*") {
            if (requestParts[idx] !== undefined && requestParts[idx + 1] === undefined) {
                returnObject.match = true;
                return returnObject;
            } else {
                returnObject.match = false;
                return returnObject;
            }
        } else if (part === "**") {
            if (requestParts[idx] !== undefined) {
                returnObject.match = true;
                return returnObject;
            } else {
                returnObject.match = false;
                return returnObject;
            }
        } else if (part[0] === ":") {
            if (requestParts[idx] !== undefined) {
                returnObject.urlParameters[part.substring(1)] = requestParts[idx];
            } else {
                returnObject.match = false;
                return returnObject;
            }
        } else if (part !== requestParts[idx]) {
            returnObject.match = false;
            return returnObject;
        }
        // if neither of these cases match, then the current tokens from the request and the route match
    }

    // if no return was reached until this point, then the URLs must match for all parts of the route
    // but the requested URL might have more components
    // since if any wildcard matched this function would hve already returned, we can simply check the amount of parts
    if (requestParts.length === routeParts.length) {
        returnObject.match = true;
    } else {
        returnObject.match = false;
    }
    return returnObject;
}
