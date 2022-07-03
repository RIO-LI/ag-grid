var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { Shape } from "./shape";
import { Path2D } from "../path2D";
import { RedrawType, SceneChangeDetection } from "../node";
export function ScenePathChangeDetection(opts) {
    var _a = opts || {}, _b = _a.redraw, redraw = _b === void 0 ? RedrawType.MAJOR : _b, changeCb = _a.changeCb, convertor = _a.convertor;
    return SceneChangeDetection({ redraw: redraw, type: 'path', convertor: convertor, changeCb: changeCb });
}
var Path = /** @class */ (function (_super) {
    __extends(Path, _super);
    function Path() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        /**
         * Declare a path to retain for later rendering and hit testing
         * using custom Path2D class. Think of it as a TypeScript version
         * of the native Path2D (with some differences) that works in all browsers.
         */
        _this.path = new Path2D();
        /**
        * The path only has to be updated when certain attributes change.
        * For example, if transform attributes (such as `translationX`)
        * are changed, we don't have to update the path. The `dirtyPath` flag
        * is how we keep track if the path has to be updated or not.
        */
        _this._dirtyPath = true;
        /**
         * Path definition in SVG path syntax:
         * https://www.w3.org/TR/SVG11/paths.html#DAttribute
         */
        _this._svgPath = '';
        return _this;
    }
    Object.defineProperty(Path.prototype, "dirtyPath", {
        get: function () {
            return this._dirtyPath;
        },
        set: function (value) {
            if (this._dirtyPath !== value) {
                this._dirtyPath = value;
                if (value) {
                    this.markDirty(this, RedrawType.MAJOR);
                }
            }
        },
        enumerable: true,
        configurable: true
    });
    Path.prototype.checkPathDirty = function () {
        var _a, _b, _c, _d;
        if (this._dirtyPath) {
            return;
        }
        this.dirtyPath = this.path.isDirty() ||
            (_b = (_a = this.fillShadow) === null || _a === void 0 ? void 0 : _a.isDirty(), (_b !== null && _b !== void 0 ? _b : false)) ||
            (_d = (_c = this.strokeShadow) === null || _c === void 0 ? void 0 : _c.isDirty(), (_d !== null && _d !== void 0 ? _d : false));
    };
    Object.defineProperty(Path.prototype, "svgPath", {
        get: function () {
            return this._svgPath;
        },
        set: function (value) {
            if (this._svgPath !== value) {
                this._svgPath = value;
                this.path.setFromString(value);
                this.markDirty(this, RedrawType.MAJOR);
            }
        },
        enumerable: true,
        configurable: true
    });
    Path.prototype.isPointInPath = function (x, y) {
        var point = this.transformPoint(x, y);
        return this.path.closedPath && this.path.isPointInPath(point.x, point.y);
    };
    Path.prototype.isDirtyPath = function () {
        // Override point for more expensive dirty checks.
    };
    Path.prototype.updatePath = function () {
        // Override point for subclasses.
    };
    Path.prototype.render = function (renderCtx) {
        var _a, _b, _c;
        var ctx = renderCtx.ctx, forceRender = renderCtx.forceRender, stats = renderCtx.stats;
        if (this.dirty === RedrawType.NONE && !forceRender) {
            if (stats)
                stats.nodesSkipped += this.nodeCount.count;
            return;
        }
        this.computeTransformMatrix();
        this.matrix.toContext(ctx);
        if (this.dirtyPath || this.isDirtyPath()) {
            this.updatePath();
            this.dirtyPath = false;
        }
        if (this.clipPath) {
            ctx.save();
            if (this.clipMode === 'normal') {
                // Bound the shape rendered to the clipping path.
                this.clipPath.draw(ctx);
                ctx.clip();
            }
            this.path.draw(ctx);
            this.fillStroke(ctx);
            if (this.clipMode === 'punch-out') {
                // Bound the shape rendered to outside the clipping path.
                this.clipPath.draw(ctx);
                ctx.clip();
                // Fallback values, but practically these should never be used.
                var _d = (_a = this.computeBBox(), (_a !== null && _a !== void 0 ? _a : {})), _e = _d.x, x = _e === void 0 ? -10000 : _e, _f = _d.y, y = _f === void 0 ? -10000 : _f, _g = _d.width, width = _g === void 0 ? 20000 : _g, _h = _d.height, height = _h === void 0 ? 20000 : _h;
                ctx.clearRect(x, y, width, height);
            }
            ctx.restore();
        }
        else {
            this.path.draw(ctx);
            this.fillStroke(ctx);
        }
        (_b = this.fillShadow) === null || _b === void 0 ? void 0 : _b.markClean();
        (_c = this.strokeShadow) === null || _c === void 0 ? void 0 : _c.markClean();
        _super.prototype.render.call(this, renderCtx);
    };
    Path.className = 'Path';
    __decorate([
        ScenePathChangeDetection()
    ], Path.prototype, "clipPath", void 0);
    __decorate([
        ScenePathChangeDetection()
    ], Path.prototype, "clipMode", void 0);
    return Path;
}(Shape));
export { Path };
//# sourceMappingURL=path.js.map