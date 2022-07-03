export function windowValue(name) {
    var _a;
    /**
     * Redeclaration of window that is safe for use with Gatsby server-side (webpack) compilation.
     */
    var WINDOW = typeof window === "undefined" ? undefined : window;
    return (_a = WINDOW) === null || _a === void 0 ? void 0 : _a[name];
}
//# sourceMappingURL=window.js.map