import { doURLsMatch } from "../src/RouteMatcher";

it("a", () => {
    // request, route
    expect(doURLsMatch("/abc", "/abc").match).toBe(true);
    expect(doURLsMatch("/abc/", "/abc").match).toBe(true);
    expect(doURLsMatch("/abc", "/abc/").match).toBe(true);
    expect(doURLsMatch("/abc/", "/abc/").match).toBe(true);

    expect(doURLsMatch("/abc", "/abc/*").match).toBe(false);
    expect(doURLsMatch("/abc", "/abc/**").match).toBe(false);
    expect(doURLsMatch("/abc/def/a", "/abc/*").match).toBe(false);
    expect(doURLsMatch("/abc/def", "/abc/*").match).toBe(true);
    expect(doURLsMatch("/abc/def/", "/abc/*/").match).toBe(true);
    expect(doURLsMatch("/abc/def/a", "/abc/**").match).toBe(true);

    expect(doURLsMatch("/abc", "/:a").match).toBe(true);
    expect(doURLsMatch("/abc/def", "/:a").match).toBe(false);
    expect(doURLsMatch("/abc/def", "/:a/").match).toBe(false);
    expect(doURLsMatch("/abc/def", "/:a/*").match).toBe(true);
    expect(doURLsMatch("/abc/def", "/:a/:b").match).toBe(true);
    expect(doURLsMatch("/abc/def", "/:a/*").match).toBe(true);

    expect(doURLsMatch("/abc/def", "/:a/:b").urlParameters).toEqual({a: "abc", b: "def"});
    expect(doURLsMatch("/abc/def", "/:a/*").urlParameters).toEqual({a: "abc"});
});