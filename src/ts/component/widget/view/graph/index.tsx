import * as React from 'react';
import { observer } from 'mobx-react';
import { I, C, S, U, J, Dataview } from 'Lib';
import { GraphProvider } from 'Component';

const WidgetViewGraph = observer(class WidgetViewGraph extends React.Component<I.WidgetViewComponent> {

	_isMounted = false;
	node: any = null;
	data: any = {
		nodes: [],
		edges: [],
	};
	ids: string[] = [];
	refGraph: any = null;
	rootId = '';

	render () {
		const { block } = this.props;

		return (
			<div 
				ref={node => this.node = node} 
				className="wrap"
			>
				<GraphProvider 
					key="graph"
					{...this.props} 
					ref={ref => this.refGraph = ref} 
					id={block.id}
					rootId="" 
					data={this.data}
					storageKey={J.Constant.graphId.dataview}
				/>
			</div>
		);
	};

	componentDidMount () {
		this._isMounted = true;

		this.resize();
		this.load();
	};

	componentDidUpdate () {
		this.resize();
	};

	componentWillUnmount () {
		this._isMounted = false;
	};

	load () {
		const { getView, getObject } = this.props;
		const view = getView();
		if (!view) {
			return;
		};

		const filters = [].concat(view.filters).concat(U.Data.graphFilters()).map(it => Dataview.filterMapper(view, it));
		const object = getObject();
		const isCollection = U.Object.isCollectionLayout(object.layout);

		C.ObjectGraph(S.Common.space, filters, 0, [], J.Relation.graph, (isCollection ? object.id : ''), object.setOf, (message: any) => {
			if (!this._isMounted || message.error.code) {
				return;
			};

			this.data.edges = message.edges;
			this.data.nodes = message.nodes;
			this.forceUpdate();

			if (this.refGraph) {
				this.refGraph.init();
			};
		});
	};

	resize () {
		this.refGraph?.resize();
	};

});

export default WidgetViewGraph;