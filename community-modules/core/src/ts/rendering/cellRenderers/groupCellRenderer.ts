import { GridOptionsWrapper } from "../../gridOptionsWrapper";
import { ExpressionService } from "../../valueService/expressionService";
import { Constants } from "../../constants/constants";
import { Autowired } from "../../context/context";
import { Component } from "../../widgets/component";
import { ICellRendererComp, ICellRendererParams } from "./iCellRenderer";
import { RowNode } from "../../entities/rowNode";
import { ValueFormatterService } from "../valueFormatterService";
import { CheckboxSelectionComponent } from "../checkboxSelectionComponent";
import { ColumnController } from "../../columnController/columnController";
import { Column } from "../../entities/column";
import { RefSelector } from "../../widgets/componentAnnotations";
import { ColDef } from "../../entities/colDef";
import {
    ComponentClassDef,
    ComponentSource,
    UserComponentFactory
} from "../../components/framework/userComponentFactory";
import { Promise } from "../../utils";
import { doOnce } from "../../utils/function";
import { get, cloneObject } from "../../utils/object";
import { bindCellRendererToHtmlElement } from "../../utils/general";
import { addOrRemoveCssClass, setDisplayed } from "../../utils/dom";
import { createIconNoSpan } from "../../utils/icon";
import { isKeyPressed } from "../../utils/keyboard";
import { missing, exists } from "../../utils/generic";
import { isStopPropagationForAgGrid, stopPropagationForAgGrid, isElementInEventPath } from "../../utils/event";
import { setAriaExpanded, removeAriaExpanded } from "../../utils/aria";
import { KeyCode } from '../../constants/keyCode';

export interface GroupCellRendererParams extends ICellRendererParams {
    pinned: string;
    suppressPadding: boolean;
    suppressDoubleClickExpand: boolean;
    suppressEnterExpand: boolean;
    footerValueGetter: any;
    suppressCount: boolean;
    fullWidth: boolean;
    checkbox: any;
    scope: any;

    /** @deprecated */
    padding: number;
}

export class GroupCellRenderer extends Component implements ICellRendererComp {

    private static TEMPLATE = /* html */
        `<span class="ag-cell-wrapper">
            <span class="ag-group-expanded" ref="eExpanded"></span>
            <span class="ag-group-contracted" ref="eContracted"></span>
            <span class="ag-group-checkbox ag-invisible" ref="eCheckbox"></span>
            <span class="ag-group-value" ref="eValue"></span>
            <span class="ag-group-child-count" ref="eChildCount"></span>
        </span>`;

    @Autowired('gridOptionsWrapper') private gridOptionsWrapper: GridOptionsWrapper;
    @Autowired('expressionService') private expressionService: ExpressionService;
    @Autowired('valueFormatterService') private valueFormatterService: ValueFormatterService;
    @Autowired('columnController') private columnController: ColumnController;
    @Autowired('userComponentFactory') private userComponentFactory: UserComponentFactory;

    @RefSelector('eExpanded') private eExpanded: HTMLElement;
    @RefSelector('eContracted') private eContracted: HTMLElement;
    @RefSelector('eCheckbox') private eCheckbox: HTMLElement;
    @RefSelector('eValue') private eValue: HTMLElement;
    @RefSelector('eChildCount') private eChildCount: HTMLElement;

    private params: GroupCellRendererParams;

    // will be true if the node was pulled down
    private draggedFromHideOpenParents: boolean;

    // this is normally the rowNode of this row, however when doing hideOpenParents, it will
    // be the parent who's details we are actually showing if the data was pulled down.
    private displayedGroup: RowNode;

    private cellIsBlank: boolean;

    // keep reference to this, so we can remove again when indent changes
    private indentClass: string;

    // this cell renderer
    private innerCellRenderer: ICellRendererComp;

    constructor() {
        super(GroupCellRenderer.TEMPLATE);
    }

    public init(params: GroupCellRendererParams): void {
        this.params = params;

        if (this.gridOptionsWrapper.isGroupIncludeTotalFooter()) {
            this.assignBlankValueToGroupFooterCell(params);
        }

        const embeddedRowMismatch = this.isEmbeddedRowMismatch();
        // This allows for empty strings to appear as groups since
        // it will only return for null or undefined.
        const nullValue = params.value == null;
        let skipCell = false;

        // if the groupCellRenderer is inside of a footer and groupHideOpenParents is true
        // we should only display the groupCellRenderer if the current column is the rowGroupedColumn
        if (this.gridOptionsWrapper.isGroupIncludeFooter() && this.gridOptionsWrapper.isGroupHideOpenParents()) {
            const node = params.node;

            if (node.footer) {
                const showRowGroup = params.colDef && params.colDef.showRowGroup;
                const rowGroupColumnId = node.rowGroupColumn && node.rowGroupColumn.getColId();

                skipCell = showRowGroup !== rowGroupColumnId;
            }
        }

        this.cellIsBlank = embeddedRowMismatch || nullValue || skipCell;

        if (this.cellIsBlank) { return; }

        this.setupDragOpenParents();
        this.addExpandAndContract();
        this.addCheckboxIfNeeded();
        this.addValueElement();
        this.setupIndent();
    }

    private assignBlankValueToGroupFooterCell(params: GroupCellRendererParams) {
        // this is not ideal, but it was the only way we could get footer working for the root node
        if (!params.value && params.node.level == -1) {
            params.value = '';
        }
    }

    // if we are doing embedded full width rows, we only show the renderer when
    // in the body, or if pinning in the pinned section, or if pinning and RTL,
    // in the right section. otherwise we would have the cell repeated in each section.
    private isEmbeddedRowMismatch(): boolean {
        if (!this.params.fullWidth || !this.gridOptionsWrapper.isEmbedFullWidthRows()) { return false; }

        const pinnedLeftCell = this.params.pinned === Constants.PINNED_LEFT;
        const pinnedRightCell = this.params.pinned === Constants.PINNED_RIGHT;
        const bodyCell = !pinnedLeftCell && !pinnedRightCell;

        if (this.gridOptionsWrapper.isEnableRtl()) {
            if (this.columnController.isPinningLeft()) {
                return !pinnedRightCell;
            }
            return !bodyCell;
        }

        if (this.columnController.isPinningLeft()) {
            return !pinnedLeftCell;
        }

        return !bodyCell;
    }

    private setIndent(): void {
        if (this.gridOptionsWrapper.isGroupHideOpenParents()) { return; }

        const params = this.params;
        const rowNode: RowNode = params.node;
        // if we are only showing one group column, we don't want to be indenting based on level
        const fullWithRow = !!params.colDef;
        const manyDimensionThisColumn = !fullWithRow || params.colDef.showRowGroup === true;
        const paddingCount = manyDimensionThisColumn ? rowNode.uiLevel : 0;
        const userProvidedPaddingPixelsTheDeprecatedWay = params.padding >= 0;

        if (userProvidedPaddingPixelsTheDeprecatedWay) {
            this.setPaddingDeprecatedWay(paddingCount, params.padding);
            return;
        }

        if (this.indentClass) {
            this.removeCssClass(this.indentClass);
        }

        this.indentClass = 'ag-row-group-indent-' + paddingCount;
        this.addCssClass(this.indentClass);
    }

    private setPaddingDeprecatedWay(paddingCount: number, padding: number): void {
        doOnce(() => console.warn('ag-Grid: since v14.2, configuring padding for groupCellRenderer should be done with Sass variables and themes. Please see the ag-Grid documentation page for Themes, in particular the property $row-group-indent-size.'), 'groupCellRenderer->doDeprecatedWay');

        const paddingPx = paddingCount * padding;
        const eGui = this.getGui();
        const paddingSide = this.gridOptionsWrapper.isEnableRtl() ? 'paddingRight' : 'paddingLeft';

        eGui.style[paddingSide] = `${paddingPx}px`;
    }

    private setupIndent(): void {
        // only do this if an indent - as this overwrites the padding that
        // the theme set, which will make things look 'not aligned' for the
        // first group level.
        const node: RowNode = this.params.node;
        const suppressPadding = this.params.suppressPadding;

        if (!suppressPadding) {
            this.addManagedListener(node, RowNode.EVENT_UI_LEVEL_CHANGED, this.setIndent.bind(this));
            this.setIndent();
        }
    }

    private addValueElement(): void {
        const params = this.params;
        const rowNode = this.displayedGroup;

        if (rowNode.footer) {
            this.createFooterCell();
        } else if (
            rowNode.hasChildren() ||
            get(params.colDef, 'cellRendererParams.innerRenderer', null) ||
            get(params.colDef, 'cellRendererParams.innerRendererFramework', null)
        ) {
            this.createGroupCell();
            if (rowNode.hasChildren()) {
                this.addChildCount();
            }
        } else {
            this.createLeafCell();
        }
    }

    private createFooterCell(): void {
        const footerValueGetter = this.params.footerValueGetter;
        let footerValue: string;

        if (footerValueGetter) {
            // params is same as we were given, except we set the value as the item to display
            const paramsClone: any = cloneObject(this.params);
            paramsClone.value = this.params.value;

            if (typeof footerValueGetter === 'function') {
                footerValue = footerValueGetter(paramsClone);
            } else if (typeof footerValueGetter === 'string') {
                footerValue = this.expressionService.evaluate(footerValueGetter, paramsClone);
            } else {
                console.warn('ag-Grid: footerValueGetter should be either a function or a string (expression)');
            }
        } else {
            footerValue = 'Total ' + this.params.value;
        }

        this.eValue.innerHTML = footerValue;
    }

    private createGroupCell(): void {
        const params = this.params;
        const rowGroupColumn = this.displayedGroup.rowGroupColumn;
        // we try and use the cellRenderer of the column used for the grouping if we can
        const columnToUse: Column = rowGroupColumn ? rowGroupColumn : params.column;
        const groupName = this.params.value;
        const valueFormatted = columnToUse ?
            this.valueFormatterService.formatValue(columnToUse, params.node, params.scope, groupName) : null;

        params.valueFormatted = valueFormatted;

        let rendererPromise: Promise<ICellRendererComp>;

        rendererPromise = params.fullWidth
            ? this.useFullWidth(params)
            : this.useInnerRenderer(
                this.params.colDef.cellRendererParams,
                columnToUse.getColDef(),
                params
            );

        // retain a reference to the created renderer - we'll use this later for cleanup (in destroy)
        if (rendererPromise) {
            rendererPromise.then((value: ICellRendererComp) => {
                this.innerCellRenderer = value;
            });
        }
    }

    private useInnerRenderer(
        groupCellRendererParams: GroupCellRendererParams,
        groupedColumnDef: ColDef, // the column this group row is for, eg 'Country'
        params: ICellRendererParams
    ): Promise<ICellRendererComp> {
        // when grouping, the normal case is we use the cell renderer of the grouped column. eg if grouping by country
        // and then rating, we will use the country cell renderer for each country group row and likewise the rating
        // cell renderer for each rating group row.
        //
        // however if the user has innerCellRenderer defined, this gets preference and we don't use cell renderers
        // of the grouped columns.
        //
        // so we check and use in the following order:
        //
        // 1) thisColDef.cellRendererParams.innerRenderer of the column showing the groups (eg auto group column)
        // 2) groupedColDef.cellRenderer of the grouped column
        // 3) groupedColDef.cellRendererParams.innerRenderer
        let cellRendererPromise: Promise<ICellRendererComp> = null;

        // we check if cell renderer provided for the group cell renderer, eg colDef.cellRendererParams.innerRenderer
        const groupInnerRendererClass: ComponentClassDef<any, any, any> = this.userComponentFactory
            .lookupComponentClassDef(groupCellRendererParams, "innerRenderer");

        if (groupInnerRendererClass && groupInnerRendererClass.component != null
            && groupInnerRendererClass.source != ComponentSource.DEFAULT) {
            // use the renderer defined in cellRendererParams.innerRenderer
            cellRendererPromise = this.userComponentFactory.newInnerCellRenderer(groupCellRendererParams, params);
        } else {
            // otherwise see if we can use the cellRenderer of the column we are grouping by
            const groupColumnRendererClass: ComponentClassDef<any, any, any> = this.userComponentFactory
                .lookupComponentClassDef(groupedColumnDef, "cellRenderer");

            if (
                groupColumnRendererClass &&
                groupColumnRendererClass.source != ComponentSource.DEFAULT
            ) {
                // Only if the original column is using a specific renderer, it it is a using a DEFAULT one ignore it
                cellRendererPromise = this.userComponentFactory.newCellRenderer(groupedColumnDef, params);
            } else if (
                groupColumnRendererClass &&
                groupColumnRendererClass.source == ComponentSource.DEFAULT &&
                (get(groupedColumnDef, 'cellRendererParams.innerRenderer', null))
            ) {
                // EDGE CASE - THIS COMES FROM A COLUMN WHICH HAS BEEN GROUPED DYNAMICALLY, THAT HAS AS RENDERER 'group'
                // AND HAS A INNER CELL RENDERER
                cellRendererPromise = this.userComponentFactory.newInnerCellRenderer(groupedColumnDef.cellRendererParams, params);
            } else {
                // This forces the retrieval of the default plain cellRenderer that just renders the values.
                cellRendererPromise = this.userComponentFactory.newCellRenderer({}, params);
            }
        }

        if (cellRendererPromise != null) {
            cellRendererPromise.then(rendererToUse => {
                if (rendererToUse == null) {
                    this.eValue.innerText = params.valueFormatted != null ? params.valueFormatted : params.value;
                    return;
                }
                bindCellRendererToHtmlElement(cellRendererPromise, this.eValue);
            });
        } else {
            this.eValue.innerText = params.valueFormatted != null ? params.valueFormatted : params.value;
        }

        return cellRendererPromise;
    }

    private useFullWidth(params: ICellRendererParams): Promise<ICellRendererComp> {
        const cellRendererPromise: Promise<ICellRendererComp> = this.userComponentFactory.newFullWidthGroupRowInnerCellRenderer(params);

        if (cellRendererPromise != null) {
            bindCellRendererToHtmlElement(cellRendererPromise, this.eValue);
        } else {
            this.eValue.innerText = params.valueFormatted != null ? params.valueFormatted : params.value;
        }

        return cellRendererPromise;
    }

    private addChildCount(): void {
        // only include the child count if it's included, eg if user doing custom aggregation,
        // then this could be left out, or set to -1, ie no child count
        if (this.params.suppressCount) { return; }

        this.addManagedListener(this.displayedGroup, RowNode.EVENT_ALL_CHILDREN_COUNT_CHANGED, this.updateChildCount.bind(this));

        // filtering changes the child count, so need to cater for it
        this.updateChildCount();
    }

    private updateChildCount(): void {
        const allChildrenCount = this.displayedGroup.allChildrenCount;

        this.eChildCount.innerHTML = allChildrenCount >= 0 ? `(${allChildrenCount})` : ``;
    }

    private createLeafCell(): void {
        if (exists(this.params.value)) {
            this.eValue.innerText = this.params.valueFormatted ? this.params.valueFormatted : this.params.value;
        }
    }

    private isUserWantsSelected(): boolean {
        const paramsCheckbox = this.params.checkbox;

        if (typeof paramsCheckbox === 'function') { return paramsCheckbox(this.params); }

        return paramsCheckbox === true;
    }

    private addCheckboxIfNeeded(): void {
        const rowNode = this.displayedGroup;
        const checkboxNeeded = this.isUserWantsSelected() &&
            // footers cannot be selected
            !rowNode.footer &&
            // pinned rows cannot be selected
            !rowNode.rowPinned &&
            // details cannot be selected
            !rowNode.detail;

        if (checkboxNeeded) {
            const cbSelectionComponent = new CheckboxSelectionComponent();
            this.getContext().createBean(cbSelectionComponent);

            cbSelectionComponent.init({ rowNode: rowNode, column: this.params.column });
            this.eCheckbox.appendChild(cbSelectionComponent.getGui());
            this.addDestroyFunc(() => this.getContext().destroyBean(cbSelectionComponent));
        }

        addOrRemoveCssClass(this.eCheckbox, 'ag-invisible', !checkboxNeeded);
    }

    private addExpandAndContract(): void {
        const params = this.params;
        const eGroupCell = params.eGridCell;
        const eExpandedIcon = createIconNoSpan('groupExpanded', this.gridOptionsWrapper, null);
        const eContractedIcon = createIconNoSpan('groupContracted', this.gridOptionsWrapper, null);

        setAriaExpanded(eGroupCell, !!params.node.expanded);
        this.eExpanded.appendChild(eExpandedIcon);
        this.eContracted.appendChild(eContractedIcon);

        this.addManagedListener(this.eExpanded, 'click', this.onExpandClicked.bind(this));
        this.addManagedListener(this.eContracted, 'click', this.onExpandClicked.bind(this));
        // expand / contract as the user hits enter
        this.addManagedListener(eGroupCell, 'keydown', this.onKeyDown.bind(this));
        this.addManagedListener(params.node, RowNode.EVENT_EXPANDED_CHANGED, this.showExpandAndContractIcons.bind(this));

        this.showExpandAndContractIcons();

        // because we don't show the expand / contract when there are no children, we need to check every time
        // the number of children change.
        const expandableChangedListener = this.onRowNodeIsExpandableChanged.bind(this);
        this.addManagedListener(this.displayedGroup, RowNode.EVENT_ALL_CHILDREN_COUNT_CHANGED, expandableChangedListener);
        this.addManagedListener(this.displayedGroup, RowNode.EVENT_MASTER_CHANGED, expandableChangedListener);
        this.addManagedListener(this.displayedGroup, RowNode.EVENT_HAS_CHILDREN_CHANGED, expandableChangedListener);

        // if editing groups, then double click is to start editing
        if (!this.gridOptionsWrapper.isEnableGroupEdit() && this.isExpandable() && !params.suppressDoubleClickExpand) {
            this.addManagedListener(eGroupCell, 'dblclick', this.onCellDblClicked.bind(this));
        }
    }

    private onRowNodeIsExpandableChanged(): void {
        // maybe if no children now, we should hide the expand / contract icons
        this.showExpandAndContractIcons();
        // if we have no children, this impacts the indent
        this.setIndent();
    }

    private onKeyDown(event: KeyboardEvent): void {
        const enterKeyPressed = isKeyPressed(event, KeyCode.ENTER);

        if (!enterKeyPressed || this.params.suppressEnterExpand) { return; }

        const cellEditable = this.params.column && this.params.column.isCellEditable(this.params.node);

        if (cellEditable) { return; }

        event.preventDefault();
        this.onExpandOrContract();
    }

    private setupDragOpenParents(): void {
        const column = this.params.column;
        const rowNode: RowNode = this.params.node;

        if (!this.gridOptionsWrapper.isGroupHideOpenParents()) {
            this.draggedFromHideOpenParents = false;
        } else if (!rowNode.hasChildren()) {
            // if we are here, and we are not a group, then we must of been dragged down,
            // as otherwise the cell would be blank, and if cell is blank, this method is never called.
            this.draggedFromHideOpenParents = true;
        } else {
            const rowGroupColumn = rowNode.rowGroupColumn;
            if (rowGroupColumn) {
                // if the displayGroup column for this col matches the rowGroupColumn we grouped by for this node,
                // then nothing was dragged down
                this.draggedFromHideOpenParents = !column.isRowGroupDisplayed(rowGroupColumn.getId());
            } else {
                // the only way we can end up here (no column, but a group) is if we are at the root node,
                // which only happens when 'groupIncludeTotalFooter' is true. here, we are never dragging
                this.draggedFromHideOpenParents = false;
            }
        }

        if (this.draggedFromHideOpenParents) {
            let pointer = rowNode.parent;

            while (true) {
                if (missing(pointer)) {
                    break;
                }
                if (pointer.rowGroupColumn && column.isRowGroupDisplayed(pointer.rowGroupColumn.getId())) {
                    this.displayedGroup = pointer;
                    break;
                }
                pointer = pointer.parent;
            }
        }

        // if we didn't find a displayed group, set it to the row node
        if (missing(this.displayedGroup)) {
            this.displayedGroup = rowNode;
        }
    }

    public onExpandClicked(mouseEvent: MouseEvent): void {
        if (isStopPropagationForAgGrid(mouseEvent)) { return; }

        // so if we expand a node, it does not also get selected.
        stopPropagationForAgGrid(mouseEvent);

        this.onExpandOrContract();
    }

    public onCellDblClicked(mouseEvent: MouseEvent): void {
        if (isStopPropagationForAgGrid(mouseEvent)) { return; }

        // we want to avoid acting on double click events on the expand / contract icon,
        // as that icons already has expand / collapse functionality on it. otherwise if
        // the icon was double clicked, we would get 'click', 'click', 'dblclick' which
        // is open->close->open, however double click should be open->close only.
        const targetIsExpandIcon
            = isElementInEventPath(this.eExpanded, mouseEvent)
            || isElementInEventPath(this.eContracted, mouseEvent);

        if (!targetIsExpandIcon) {
            this.onExpandOrContract();
        }
    }

    public onExpandOrContract(): void {
        // must use the displayedGroup, so if data was dragged down, we expand the parent, not this row
        const rowNode: RowNode = this.displayedGroup;
        const params = this.params;
        const nextExpandState = !rowNode.expanded;

        rowNode.setExpanded(nextExpandState);
        setAriaExpanded(params.eGridCell, nextExpandState);
    }

    private isExpandable(): boolean {
        const rowNode = this.params.node;
        const reducedLeafNode = this.columnController.isPivotMode() && rowNode.leafGroup;

        return this.draggedFromHideOpenParents ||
            (rowNode.isExpandable() && !rowNode.footer && !reducedLeafNode);
    }

    private showExpandAndContractIcons(): void {
        const { eContracted, eExpanded, params, displayedGroup, columnController } = this;
        const { eGridCell, node } = params;

        if (this.isExpandable()) {
            // if expandable, show one based on expand state.
            // if we were dragged down, means our parent is always expanded
            const expanded = this.draggedFromHideOpenParents ? true : node.expanded;
            setDisplayed(eContracted, !expanded);
            setDisplayed(eExpanded, expanded);
        } else {
            // it not expandable, show neither
            removeAriaExpanded(eGridCell);
            setDisplayed(eExpanded, false);
            setDisplayed(eContracted, false);
        }

        // compensation padding for leaf nodes, so there is blank space instead of the expand icon
        const pivotModeAndLeafGroup = columnController.isPivotMode() && displayedGroup.leafGroup;
        const notExpandable = !displayedGroup.isExpandable();
        const addLeafIndentClass = displayedGroup.footer || notExpandable || pivotModeAndLeafGroup;

        this.addOrRemoveCssClass('ag-row-group', !addLeafIndentClass);
        this.addOrRemoveCssClass('ag-row-group-leaf-indent', addLeafIndentClass);
    }

    // this is a user component, and IComponent has "public destroy()" as part of the interface.
    // so we need to have public here instead of private or protected
    public destroy(): void {
        this.getContext().destroyBean(this.innerCellRenderer);
        super.destroy();
    }

    public refresh(): boolean {
        return false;
    }
}
