import pc from "picocolors";

export function logError(msg: string) {
    console.log(pc.bgRed(pc.white(pc.bold("  ERROR  "))) + " " + msg);
}

export function checkHeaderToken(token: string | string[]): boolean {
    if (token === undefined) return false;

    const isValid = (a: string) => {
        return !(a.indexOf(";") !== -1 || a.indexOf("=") !== -1);
    };

    if (Array.isArray(token)) {
        let valid = true;
        token.forEach((t) => {
            if (!isValid(t)) valid = false;
        });
        return valid;
    } else {
        return isValid(token);
    }
}