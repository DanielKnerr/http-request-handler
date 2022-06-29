import * as http from "http";
import { checkHeaderToken, logError } from "./util";
import * as pug from "pug";

type CookieOptions = {
    Expires: Date,
    MaxAge: number,
    Domain: string,
    Path: string,
    Secure: boolean,
    HttpOnly: boolean,
    SameSite: "Strict" | "Lax" | "None"
}

type ResponseOptions = {
    contentType: string,
    code: number
}

interface BufferOptions extends Partial<ResponseOptions> {
    contentType: string
}

export class Response {
    /**
     * @ignore
     */
    #httpResponse: http.ServerResponse;
    /**
     * @ignore
     */
    #responseSent = false;
    /**
     * @ignore
     */
    #cookiesToSet: { key: string, value: string }[] = [];
    /**
     * @ignore
     */
    #headersToSet: { [key: string]: string | string[] } = {};
    /**
     * @ignore
     */
    #errorCodeStringMap = new Map([
        [404, "Not Found"],
        [500, "Internal Server Error"]
    ]);
    /**
     * @ignore
     */
    #sendCallback: ((a: void) => void) | undefined;


    #pugTemplateMap: Map<string, pug.compileTemplate>;

    /**
     * @ignore
     */
    constructor(httpResponse: http.ServerResponse, pugTemplateMap: Map<string, pug.compileTemplate>) {
        this.#httpResponse = httpResponse;
        this.#pugTemplateMap = pugTemplateMap;
    }

    /**
     * @ignore
     */
    setSendCallback(func: (a: void) => void) {
        this.#sendCallback = func;
    }

    unsetSendCallback() {
        this.#sendCallback = undefined;
    }

    /**
     * Set a header key-value pair.
     * @param key the header name
     * @param value the value of the header, either as a string or as a string array
     */
    setHeader(key: string, value: string | string[]) {
        if (checkHeaderToken(key) && checkHeaderToken(value)) {
            this.#headersToSet[key] = value;
        } else {
            logError("Invalid header key or value: " + key + ", " + value);
        }
    }

    /**
     * Set a cookie
     * @param key the name of the cookie
     * @param value the value of the cookie
     * @param options an object describing the options for this cookie
     */
    setCookie(key: string, value: string, options?: Partial<CookieOptions>) {
        if (checkHeaderToken(key) && checkHeaderToken(value)) {
            let valueString = value + "; ";

            if (options !== undefined && options !== null) {
                if (options.Expires !== undefined) valueString += "Expires=" + options.Expires.toUTCString() + "; ";
                if (options.MaxAge !== undefined) valueString += "Max-Age=" + options.MaxAge.toString() + "; ";
                if (options.Domain !== undefined) valueString += "Domain=" + options.Domain + "; ";
                if (options.Path !== undefined) valueString += "Path=" + options.Path + "; ";

                if (options.Secure === true) valueString += "Secure; ";
                if (options.HttpOnly === true) valueString += "HttpOnly; ";

                if (options.SameSite !== undefined) valueString += "SameSite=" + options.SameSite + "; ";

                if (options.SameSite === "None" && options.Secure !== true) {
                    logError("If the 'SameSite' option of a header is set to 'None', the 'Secure' option must be enabled");
                }
            }

            this.#cookiesToSet.push({ key: key, value: valueString });
        } else {
            logError("Invalid header key or value: " + key + ", " + value);
        }

    }

    /**
     * Respond with an HTTP error code
     * @param errorCode the HTTP error code
     */
    error(errorCode: number) {
        if (!this.#responseSent) {
            this.#responseSent = true;
            this.#applyCookiesAndHeaders();

            this.#httpResponse.writeHead(errorCode);
            const errorString = this.#errorCodeStringMap.get(errorCode);
            if (errorString !== undefined) {
                this.#httpResponse.write(errorString);
            } else {
                this.#httpResponse.write(errorCode.toString());
            }
            this.#httpResponse.end();
        }
    }

    /**
     * Sends an empty response with a 200 HTTP code to the client.
     */
    ok() {
        this.send("ok");
    }

    renderPugTemplate(name: string, values: Object = {}) {
        let fn = this.#pugTemplateMap.get(name);
        if (typeof fn !== "undefined") {
            let html = fn(values);
            this.send(html, {contentType: "text/html"});
        } else {
            logError(`Pug template "${name}" does not exist.`);
        }
    }

    redirect(str: string) {
        this.#httpResponse.writeHead(301, {
            "Location": str
        });
        this.#httpResponse.end();
    }

    #applyCookiesAndHeaders() {
        if (this.#cookiesToSet.length > 0) {
            const cookieHeaders = [];
            for (const cookie of this.#cookiesToSet) {
                cookieHeaders.push(cookie.key + "=" + cookie.value);
            }
            this.#httpResponse.setHeader("Set-Cookie", cookieHeaders);
        }

        for (const key in this.#headersToSet) {
            this.#httpResponse.setHeader(key, this.#headersToSet[key]);
        }
    }

    /**
     * Send data to the client. If no data is provided an empty string will be sent. This function can only be called once.
     * @param data what data to send
     */
    send(data: string | number | boolean | object, options?: Partial<ResponseOptions>): void;
    /**
     * Send a buffer to the client.
     * @param data the buffer containing the data
     * @param mimeType a string containing the MIME-type
     */
    send(data: Buffer, options: BufferOptions): void;
    send(data: string | number | boolean | object | Buffer, options?: Partial<ResponseOptions>): void {
        if (!this.#responseSent) {
            this.#responseSent = true;

            // set an array as the value to send multiple headers with the same name
            // see https://nodejs.org/dist/latest-v8.x/docs/api/http.html#http_response_setheader_name_value
            this.#applyCookiesAndHeaders();

            let error = false;

            let content: string | Buffer = "";
            if (data !== undefined) {
                if (typeof data === "string") {
                    content = data;

                    if (typeof options?.contentType !== "undefined") {
                        this.#httpResponse.setHeader("Content-Type", options.contentType + ";");
                    } else {
                        this.#httpResponse.setHeader("Content-Type", "text/plain; charset=UTF-8");
                    }
                } else if (typeof data === "number") {
                    content = data.toString();
                    this.#httpResponse.setHeader("Content-Type", "text/plain; charset=UTF-8");
                } else if (typeof data === "boolean") {
                    content = data.toString();
                    this.#httpResponse.setHeader("Content-Type", "text/plain; charset=UTF-8");
                } else if ((data as unknown) instanceof Buffer) {
                    content = data as Buffer;

                    if (typeof options?.contentType !== "undefined") {
                        this.#httpResponse.setHeader("Content-Type", (options.contentType as string) + ";");
                    } else {
                        logError("When responding with a Buffer a MIME-type (Content-Type) must be provided to Response.send");
                        error = true;
                    }

                } else if (typeof data === "object") {
                    content = JSON.stringify(data);
                    this.#httpResponse.setHeader("Content-Type", "application/json; charset=UTF-8");
                }
            }

            if (error) {
                this.#httpResponse.setHeader("Content-Type", "text/plain; charset=UTF-8");
                content = "500 Internal Server Error";
                logError("Can't respond with a buffer if no MIME-type is specified");
            }

            this.#httpResponse.setHeader("Content-Length", content.length);

            if (typeof options?.code !== "undefined") {
                this.#httpResponse.writeHead(options.code);
            }

            if (error) {
                this.#httpResponse.writeHead(500);
            }

            this.#httpResponse.write(content);
            this.#httpResponse.end();

            if (this.#sendCallback !== undefined) {
                this.#sendCallback();
            }
        } else {
            logError("Response already sent");
        }
    }
}