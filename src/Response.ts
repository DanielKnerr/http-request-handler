import http from "http";
import { checkHeaderToken, logError } from "./util";

type CookieOptions = {
    Expires: Date,
    MaxAge: number,
    Domain: string,
    Path: string,
    Secure: boolean,
    HttpOnly: boolean,
    SameSite: "Strict" | "Lax" | "None"
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

    /**
     * @ignore
     */
    constructor(httpResponse: http.ServerResponse) {
        this.#httpResponse = httpResponse;
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
        console.log(key, value);
        
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
        this.send();
    }

    /**
     * Send data to the client. If no data is provided an empty string will be sent. This function can only be called once.
     * @param data what data to send
     */
    send(data?: string | number | boolean | object): void;
    /**
     * Send data to the client. If no data is provided an empty string will be sent. This function can only be called once.
     * @param data what data to send
     * @param httpCode what HTTP code to send
     */
    send(data: string | number | boolean | object, httpCode: number): void;
    /**
     * Send a buffer to the client.
     * @param data the buffer containing the data
     * @param mimeType a string containing the MIME-type
     */
    send(data: Buffer, mimeType: string): void;
    send(data: string | number | boolean | object | Buffer, arg1?: string | number): void {
        if (!this.#responseSent) {
            this.#responseSent = true;

            // set an array as the value to send multiple headers with the same name
            // see https://nodejs.org/dist/latest-v8.x/docs/api/http.html#http_response_setheader_name_value

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

            let error = false;

            let content: string | Buffer = "";
            if (data !== undefined) {
                if (typeof data === "string") {
                    content = data;
                    this.#httpResponse.setHeader("Content-Type", "text/plain; charset=UTF-8");
                } else if (typeof data === "number") {
                    content = data.toString();
                    this.#httpResponse.setHeader("Content-Type", "text/plain; charset=UTF-8");
                } else if (typeof data === "boolean") {
                    content = data.toString();
                    this.#httpResponse.setHeader("Content-Type", "text/plain; charset=UTF-8");
                } else if ((data as unknown) instanceof Buffer) {
                    content = data as Buffer;

                    if (typeof arg1 === "string") {
                        this.#httpResponse.setHeader("Content-Type", (arg1 as string) + ";");
                    } else {
                        logError("When responding with a Buffer a MIME-type must be provided to Response.send");
                        error = true;
                    }

                } else if (typeof data === "object") {
                    content = JSON.stringify(data);
                    this.#httpResponse.setHeader("Content-Type", "application/json; charset=UTF-8");
                }
            }

            if (error) {
                this.#httpResponse.setHeader("Content-Type", "text/plain; charset=UTF-8");
                // TODO: unified system to error out:
                // respond not just with the code, also with an error text
                content = "500 Internal Server Error";
                logError("Can't respond with a buffer if no MIME-type is specified");
            }

            this.#httpResponse.setHeader("Content-Length", content.length);


            if (typeof arg1 === "number") {
                this.#httpResponse.writeHead(arg1);
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