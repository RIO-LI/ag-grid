<framework-specific-section frameworks="angular">
|Below is an example of floating filter component:
</framework-specific-section>

<framework-specific-section frameworks="angular">
<snippet transform={false}>
|import {IFloatingFilterAngularComp} from "ag-grid-angular";
|import {IFloatingFilterParams} from "ag-grid-community";
|
|@Component({
|    selector: 'number-component',
|    template: `&gt; &lt;input [style.color]="params.color" style="width: 30px" type="number" min="0" [(ngModel)]="currentValue"
|                           (input)="onInputBoxChanged($event)"/>`
|})
|export class NumberFloatingFilterComponent implements IFloatingFilterAngularComp {
|    params: IFloatingFilterParams;
|    currentValue: Number | null | string = null;
|    style: any;
|
|    agInit(params: IFloatingFilterParams): void {
|        this.params = params;
|
|        this.style = {
|            color: params.color
|        }
|    }
|
|    onParentModelChanged(parentModel: any) {
|        // When the filter is empty we will receive a null value here
|        if (!parentModel) {
|            this.currentValue = null;
|        } else {
|            this.currentValue = parentModel.filter;
|        }
|    }
|
|    onInputBoxChanged() {
|        if (!this.currentValue) {
|            // clear the filter
|            this.params.parentFilterInstance((instance) => {
|                instance.onFloatingFilterChanged(null, null);
|            });
|            return;
|        }
|
|        this.currentValue = Number(this.currentValue);
|        this.params.parentFilterInstance((instance) => {
|            instance.onFloatingFilterChanged('greaterThan', this.currentValue);
|        });
|    }
|}
</snippet>
</framework-specific-section>