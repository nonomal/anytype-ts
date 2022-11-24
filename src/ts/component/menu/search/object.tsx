import * as React from 'react';
import { observer } from 'mobx-react';
import { AutoSizer, CellMeasurer, InfiniteLoader, List, CellMeasurerCache } from 'react-virtualized';
import $ from 'jquery';
import { MenuItemVertical, Filter, Loader, ObjectName, EmptySearch } from 'Component';
import { I, C, keyboard, Util, DataUtil, translate, analytics, Action, focus } from 'Lib';
import { commonStore, dbStore } from 'Store';

import Constant from 'json/constant.json';

interface Props extends I.Menu {};

interface State {
	loading: boolean;
};

const LIMIT_HEIGHT = 10;

const HEIGHT_SECTION = 28;
const HEIGHT_ITEM = 28;
const HEIGHT_ITEM_BIG = 56;
const HEIGHT_DIV = 16;
const HEIGHT_FILTER = 44;
const HEIGHT_EMPTY = 98;

const MenuSearchObject = observer(class MenuSearchObject extends React.Component<Props, State> {

	state = {
		loading: false,
	};

	_isMounted: boolean = false;	
	filter: string = '';
	index: any = null;
	cache: any = {};
	items: any = [];
	refFilter: any = null;
	refList: any = null;
	n: number = -1;
	timeoutFilter: number = 0;
	offset: number = 0;

	constructor (props: any) {
		super(props);
		
		this.onClick = this.onClick.bind(this);
		this.onFilterChange = this.onFilterChange.bind(this);
		this.loadMoreRows = this.loadMoreRows.bind(this);
	};
	
	render () {
		const { loading } = this.state;
		const { param } = this.props;
		const { data } = param;
		const { filter, value, placeholder, label, isBig, noFilter, noIcon } = data;
		const items = this.getItems();
		const cn = [ 'wrap' ];
		const placeholderFocus = data.placeholderFocus || 'Filter objects...';

		if (label) {
			cn.push('withLabel');
		};
		if (!noFilter) {
			cn.push('withFilter');
		};

		const rowRenderer = (param: any) => {
			const item: any = items[param.index];
			const type = dbStore.getType(item.type);
			const cn = [];

			let content = null;

			if (item.isSection) {
				content = <div className={[ 'sectionName', (param.index == 0 ? 'first' : '') ].join(' ')} style={param.style}>{item.name}</div>;
			} else
			if (item.isDiv) {
				content = (
					<div className="separator" style={param.style}>
						<div className="inner" />
					</div>
				);
			} else
			if (item.isEmpty && !loading) {
				content = (
					<EmptySearch text={filter ? Util.sprintf(translate('popupSearchEmptyFilter'), filter) : translate('popupSearchEmpty')} />
				);
			} else {
				if (item.id == 'add') {
					cn.push('add');
				};
				if (item.isHidden) {
					cn.push('isHidden');
				};
				if (value == item.id) {
					cn.push('active');
				};

				const props = {
					...item,
					object: (item.id == 'add' ? undefined : item),
				};

				if (isBig) {
					props.withDescription = true;
					props.forceLetter = true;
					props.iconSize = 40;
				} else {
					props.withCaption = true;
					props.caption = (type ? type.name : undefined);
				};

				if (noIcon) {
					props.object = undefined;
				};

				content = <MenuItemVertical
					{...props}
					name={<ObjectName object={item} />}
					onMouseEnter={(e: any) => { this.onMouseEnter(e, item); }}
					onClick={(e: any) => { this.onClick(e, item); }}
					style={param.style}
					className={cn.join(' ')}
				/>;
			}

			return (
				<CellMeasurer
					key={param.key}
					parent={param.parent}
					cache={this.cache}
					columnIndex={0}
					rowIndex={param.index}
					hasFixedWidth={() => {}}
				>
					{content}
				</CellMeasurer>
			);
		};

		return (
			<div className={cn.join(' ')}>
				{!noFilter ? (
					<Filter 
						ref={(ref: any) => { this.refFilter = ref; }} 
						placeholder={placeholder} 
						placeholderFocus={placeholderFocus} 
						value={filter}
						onChange={this.onFilterChange} 
					/>
				) : ''}

				{loading ? <Loader /> : ''}

				{this.cache && items.length && !loading ? (
					<div className="items">
						<InfiniteLoader
							rowCount={items.length + 1}
							loadMoreRows={this.loadMoreRows}
							isRowLoaded={({ index }) => !!this.items[index]}
							threshold={LIMIT_HEIGHT}
						>
							{({ onRowsRendered, registerChild }) => (
								<AutoSizer className="scrollArea">
									{({ width, height }) => (
										<List
											ref={(ref: any) => { this.refList = ref; }}
											width={width}
											height={height}
											deferredMeasurmentCache={this.cache}
											rowCount={items.length}
											rowHeight={({ index }) => this.getRowHeight(items[index])}
											rowRenderer={rowRenderer}
											onRowsRendered={onRowsRendered}
											overscanRowCount={10}
											scrollToAlignment="center"
										/>
									)}
								</AutoSizer>
							)}
						</InfiniteLoader>
					</div>
				) : ''}
			</div>
		);
	};
	
	componentDidMount () {
		this._isMounted = true;
		this.rebind();
		this.resize();
		this.focus();
		this.load(true);
	};

	componentDidUpdate () {
		const { param } = this.props;
		const { data } = param;
		const { filter } = data;
		const items = this.getItems();

		if (this.filter != filter) {
			this.filter = filter;
			this.n = -1;
			this.offset = 0;
			this.load(true);
			return;
		};

		this.cache = new CellMeasurerCache({
			fixedWidth: true,
			defaultHeight: HEIGHT_ITEM,
			keyMapper: (i: number) => { return (items[i] || {}).id; },
		});

		this.resize();
		this.focus();
		this.props.setActive();
	};
	
	componentWillUnmount () {
		this._isMounted = false;
		window.clearTimeout(this.timeoutFilter);
	};

	rebind () {
		this.unbind();
		$(window).on('keydown.menu', (e: any) => { this.props.onKeyDown(e); });
		window.setTimeout(() => { this.props.setActive(); }, 15);
	};
	
	unbind () {
		$(window).off('keydown.menu');
	};

	focus () {
		window.setTimeout(() => {
			if (this.refFilter) {
				this.refFilter.focus();
			};
		}, 15);
	};

	getItems () {
		const { param } = this.props;
		const { data } = param;
		const { filter, label, canNotAdd } = data;

		let items = [].concat(this.items);

		if (label && items.length) {
			items.unshift({ isSection: true, name: label });
		};

		if (filter.length && !canNotAdd) {
			if (items.length) {
				items.push({ isDiv: true });
			};

			items.push({ id: 'add', icon: 'plus', name: `Create object "${filter}"` });
		};

		if (!items.length) {
			items.push({ isEmpty: true });
		};

		return items;
	};

	loadMoreRows ({ startIndex, stopIndex }) {
        return new Promise((resolve, reject) => {
			this.offset += Constant.limitMenuRecords;
			this.load(false, resolve);
		});
	};
	
	load (clear: boolean, callBack?: (message: any) => void) {
		if (!this._isMounted) {
			return;
		};

		const { param } = this.props;
		const { data } = param;
		const { filter, type, dataMapper, dataSort, skipIds, keys } = data;
		
		const filters: any[] = [
			{ operator: I.FilterOperator.And, relationKey: 'isArchived', condition: I.FilterCondition.Equal, value: false },
			{ operator: I.FilterOperator.And, relationKey: 'type', condition: I.FilterCondition.NotIn, value: [ Constant.typeId.option ] },
		].concat(data.filters || []);

		const sorts = [].concat(data.sorts || []);

		if (!sorts.length) {
			sorts.push({ relationKey: 'lastOpenedDate', type: I.SortType.Desc });
		};

		if (skipIds && skipIds.length) {
			filters.push({ operator: I.FilterOperator.And, relationKey: 'id', condition: I.FilterCondition.NotIn, value: skipIds });
		};
		if ([ I.NavigationType.Move, I.NavigationType.LinkTo ].includes(type)) {
			filters.push({ operator: I.FilterOperator.And, relationKey: 'isReadonly', condition: I.FilterCondition.Equal, value: false });
		};

		if (clear) {
			this.setState({ loading: true });
		};

		DataUtil.search({
			filters,
			sorts,
			keys: keys || Constant.defaultRelationKeys,
			fullText: filter,
			offset: this.offset,
			limit: Constant.limitMenuRecords,
		}, (message: any) => {
			if (!this._isMounted) {
				return;
			};

			if (callBack) {
				callBack(message);
			};

			if (clear) {
				this.items = [];
			};

			this.items = this.items.concat(message.records);

			if (dataMapper) {
				this.items = this.items.map(dataMapper);
			};

			if (dataSort) {
				this.items.sort(dataSort);
			};

			if (clear) {
				this.setState({ loading: false });
				analytics.event('SearchQuery', { route: 'MenuSearch', length: filter.length });
			} else {
				this.forceUpdate();
			};
		});
	};

	onMouseEnter (e: any, item: any) {
		if (!keyboard.isMouseDisabled) {
			this.props.setActive(item, false);
			this.onOver(e, item);
		};
	};

	onOver (e: any, item: any) {
		const { param } = this.props;
		const { data } = param;
		const { onOver } = data;

		if (onOver) {
			onOver(e, this, item);
		};
	};
	
	onClick (e: any, item: any) {
		e.stopPropagation();

		const { param, close } = this.props;
		const { data } = param;
		const { filter, rootId, type, blockId, blockIds, position, onSelect, noClose } = data;

		if (!noClose) {
			close();
		};

		let newBlock: any = {};

		const process = (target: any) => {
			if (onSelect) {
				onSelect(target);
			};

			if (!type) {
				return;
			};

			switch (type) {
				case I.NavigationType.Go:
					DataUtil.objectOpenEvent(e, target);
					break;

				case I.NavigationType.Move:
					Action.move(rootId, target.id, '', blockIds, I.BlockPosition.Bottom, (message: any) => {
						if (message.error.code) {
							return;
						};

						Util.toastShow({
							action: I.ToastAction.Move,
							targetId: target.id,
							count: blockIds.length,
							originId: rootId,
						});
					});
					break;

				case I.NavigationType.Link:
					switch (item.type) {
						case Constant.typeId.bookmark:
							newBlock.type = I.BlockType.Bookmark;
							newBlock.content = {
								state: I.BookmarkState.Done,
								targetObjectId: target.id,
							};
							break;

						default:
							newBlock.type = I.BlockType.Link;
							newBlock.content = {
								...DataUtil.defaultLinkSettings(),
								targetBlockId: target.id,
							};
							break;
					};

					C.BlockCreate(rootId, blockId, position, newBlock, (message: any) => {
						if (message.error.code) {
							return;
						};

						focus.set(message.blockId, { from: 0, to: 0 });
						focus.apply();

						analytics.event('CreateLink');
					});
					break;

				case I.NavigationType.LinkTo:
					newBlock = {
						type: I.BlockType.Link,
						content: {
							...DataUtil.defaultLinkSettings(),
							targetBlockId: blockId,
						}
					};

					C.BlockCreate(target.id, '', position, newBlock, (message: any) => {
						if (!message.error.code) {
							Util.toastShow({ objectId: blockId, action: I.ToastAction.Link, targetId: target.id });
							analytics.event('LinkToObject');
						};
					});
					break;
			};
		};

		if (item.id == 'add') {
			DataUtil.pageCreate('', '', { name: filter, type: commonStore.type }, I.BlockPosition.Bottom, '', {}, [ I.ObjectFlag.SelectType ], (message: any) => {
				DataUtil.getObjectById(message.targetId, process);
				close();
			});
		} else {
			process(item);
		};
	};

	onFilterChange (v: string) {
		window.clearTimeout(this.timeoutFilter);
		this.timeoutFilter = window.setTimeout(() => {
			this.props.param.data.filter = this.refFilter.getValue();
		}, 500);
	};

	getRowHeight (item: any) {
		const { param } = this.props;
		const { data } = param;
		const { isBig } = data;

		let h = HEIGHT_ITEM;

		if (isBig || item.isBig)	 h = HEIGHT_ITEM_BIG;
		if (item.isEmpty)			 h = HEIGHT_EMPTY;
		if (item.isSection)			 h = HEIGHT_SECTION;
		if (item.isDiv)				 h = HEIGHT_DIV;

		return h;
	};

	getListHeight (items: any) {
		return Math.min(300, items.reduce((res: number, item: any) => {
			res += this.getRowHeight(item);
			return res;
		}, 0));
	};

	resize () {
		if (!this._isMounted) {
			return;
		};

		const { getId, position } = this.props;
		const items = this.getItems();
		const obj = $(`#${getId()} .content`);
		const height = this.getListHeight(items) + HEIGHT_FILTER + 16;

		obj.css({ height });
		position();
	};
	
});

export default MenuSearchObject;