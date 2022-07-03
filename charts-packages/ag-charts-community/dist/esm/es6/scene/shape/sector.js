var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { Path, ScenePathChangeDetection } from "./path";
import { normalizeAngle360 } from "../../util/angle";
import { isEqual } from "../../util/number";
import { BBox } from "../bbox";
export class Sector extends Path {
    constructor() {
        super(...arguments);
        this.centerX = 0;
        this.centerY = 0;
        this.centerOffset = 0;
        this.innerRadius = 10;
        this.outerRadius = 20;
        this.startAngle = 0;
        this.endAngle = Math.PI * 2;
        this.angleOffset = 0;
    }
    computeBBox() {
        const radius = this.outerRadius;
        return new BBox(this.centerX - radius, this.centerY - radius, radius * 2, radius * 2);
    }
    isFullPie() {
        return isEqual(normalizeAngle360(this.startAngle), normalizeAngle360(this.endAngle));
    }
    updatePath() {
        const path = this.path;
        const angleOffset = this.angleOffset;
        const startAngle = Math.min(this.startAngle, this.endAngle) + angleOffset;
        const endAngle = Math.max(this.startAngle, this.endAngle) + angleOffset;
        const midAngle = (startAngle + endAngle) * 0.5;
        const innerRadius = Math.min(this.innerRadius, this.outerRadius);
        const outerRadius = Math.max(this.innerRadius, this.outerRadius);
        const centerOffset = this.centerOffset;
        const fullPie = this.isFullPie();
        let centerX = this.centerX;
        let centerY = this.centerY;
        path.clear();
        if (centerOffset) {
            centerX += centerOffset * Math.cos(midAngle);
            centerY += centerOffset * Math.sin(midAngle);
        }
        if (!fullPie) {
            path.moveTo(centerX + innerRadius * Math.cos(startAngle), centerY + innerRadius * Math.sin(startAngle));
            // if (showTip) {
            //     path.lineTo(
            //         centerX + 0.5 * (innerRadius + outerRadius) * Math.cos(startAngle) + tipOffset * Math.cos(startAngle + Math.PI / 2),
            //         centerY + 0.5 * (innerRadius + outerRadius) * Math.sin(startAngle) + tipOffset * Math.sin(startAngle + Math.PI / 2)
            //     );
            // }
            path.lineTo(centerX + outerRadius * Math.cos(startAngle), centerY + outerRadius * Math.sin(startAngle));
        }
        path.cubicArc(centerX, centerY, outerRadius, outerRadius, 0, startAngle, endAngle, 0);
        // path[fullPie ? 'moveTo' : 'lineTo'](
        //     centerX + innerRadius * Math.cos(endAngle),
        //     centerY + innerRadius * Math.sin(endAngle)
        // );
        if (fullPie) {
            path.moveTo(centerX + innerRadius * Math.cos(endAngle), centerY + innerRadius * Math.sin(endAngle));
        }
        else {
            // if (showTip) {
            //     path.lineTo(
            //         centerX + 0.5 * (innerRadius + outerRadius) * Math.cos(endAngle) + tipOffset * Math.cos(endAngle + Math.PI / 2),
            //         centerY + 0.5 * (innerRadius + outerRadius) * Math.sin(endAngle) + tipOffset * Math.sin(endAngle + Math.PI / 2)
            //     );
            // }
            // Temp workaround for https://bugs.chromium.org/p/chromium/issues/detail?id=993330
            // Revert this commit when fixed ^^.
            const x = centerX + innerRadius * Math.cos(endAngle);
            path.lineTo(Math.abs(x) < 1e-8 ? 0 : x, centerY + innerRadius * Math.sin(endAngle));
        }
        path.cubicArc(centerX, centerY, innerRadius, innerRadius, 0, endAngle, startAngle, 1);
        path.closePath();
        this.dirtyPath = false;
    }
}
Sector.className = 'Sector';
__decorate([
    ScenePathChangeDetection()
], Sector.prototype, "centerX", void 0);
__decorate([
    ScenePathChangeDetection()
], Sector.prototype, "centerY", void 0);
__decorate([
    ScenePathChangeDetection()
], Sector.prototype, "centerOffset", void 0);
__decorate([
    ScenePathChangeDetection()
], Sector.prototype, "innerRadius", void 0);
__decorate([
    ScenePathChangeDetection()
], Sector.prototype, "outerRadius", void 0);
__decorate([
    ScenePathChangeDetection()
], Sector.prototype, "startAngle", void 0);
__decorate([
    ScenePathChangeDetection()
], Sector.prototype, "endAngle", void 0);
__decorate([
    ScenePathChangeDetection()
], Sector.prototype, "angleOffset", void 0);
//# sourceMappingURL=sector.js.map