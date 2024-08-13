import * as React from 'react';
import $ from 'jquery';
import { observer } from 'mobx-react';
import { IconObject, Icon, ObjectName, Label } from 'Component';
import { I, S, U, C, Mark, translate, Preview } from 'Lib';

import Attachment from '../attachment';

interface Props extends I.BlockComponent {
	blockId: string;
	id: string;
	isThread: boolean;
	isLast?: boolean;
	onThread: (id: string) => void;
	onContextMenu: (e: any) => void;
};

const LINES_LIMIT = 10;

const ChatMessage = observer(class ChatMessage extends React.Component<Props> {

	node = null;
	refText = null;
	canExpand: boolean = false;
	isExpanded: boolean = false;

	constructor (props: Props) {
		super(props);

		this.onExpand = this.onExpand.bind(this);
		this.onReactionAdd = this.onReactionAdd.bind(this);
		this.onReactionEnter = this.onReactionEnter.bind(this);
		this.onReactionLeave = this.onReactionLeave.bind(this);
	};

	render () {
		const { rootId, blockId, id, isThread, onThread, isLast, onContextMenu } = this.props;
		const { space } = S.Common;
		const { account } = S.Auth;
		const message = S.Chat.getMessage(rootId, id);
		const { author, data } = message;
		const subId = S.Record.getSubId(rootId, blockId);
		const authorObject = U.Space.getParticipant(U.Space.getParticipantId(space, author));
		const text = U.Common.lbBr(Mark.toHtml(data.text, data.marks));
		const attachments = (data.attachments || []).map(id => S.Detail.get(subId, id));
		const reactions = data.reactions || [];
		const marks = data.marks || [];
		const hasReactions = reactions.length;
		const hasAttachments = attachments.length;
		const isSingle = attachments.length == 1;
		const cn = [ 'message' ];

		if (author == account.id) {
			cn.push('isSelf');
		};
		if (this.canExpand) {
			cn.push('canExpand');
		};
		if (this.isExpanded) {
			cn.push('isExpanded');
		};
		if (isLast) {
			cn.push('isLast');
		};

		// Subscriptions
		for (const mark of marks) {
			if ([ I.MarkType.Mention, I.MarkType.Object ].includes(mark.type)) {
				const object = S.Detail.get(rootId, mark.param, []);
			};
		};

		const Reaction = (item: any) => {
			const authors = item.authors || [];
			const length = authors.length;
			const author = length ? U.Space.getParticipant(U.Space.getParticipantId(space, authors[0])) : '';

			return (
				<div 
					className="reaction" 
					onClick={() => this.onReactionSelect(item.value)}
					onMouseEnter={e => this.onReactionEnter(e, authors)}
					onMouseLeave={this.onReactionLeave}
				>
					<div className="value">
						<IconObject object={{ iconEmoji: item.value }} size={18} />
					</div>
					<div className="count">
						{length > 1 ? length : <IconObject object={author} size={18} />}
					</div>
				</div>
			);
		};

		return (
			<div 
				ref={ref => this.node = ref} 
				id={`item-${id}`} 
				className={cn.join(' ')}
				onContextMenu={onContextMenu}
			>
				<div className="side left">
					<IconObject object={author} size={48} />
				</div>
				<div className="side right">
					{!hasReactions ? (
						<Icon id="reaction-add" className="reactionAdd" onClick={this.onReactionAdd} tooltip={translate('blockChatReactionAdd')} />
					) : ''}

					<div className="author">
						<ObjectName object={authorObject} />
						<div className="time">{U.Date.date('H:i', data.time)}</div>
					</div>

					<div className="textWrapper">
						<div 
							ref={ref => this.refText = ref} 
							className="text" 
							dangerouslySetInnerHTML={{ __html: U.Common.sanitize(text) }}
						/>

						{this.canExpand && !this.isExpanded ? (
							<div className="expand" onClick={this.onExpand}>
								{translate('blockChatMessageExpand')}
							</div>
						) : ''}
					</div>

					{hasAttachments ? (
						<div className={[ 'attachments', (isSingle ? 'isSingle' : '') ].join(' ')}>
							{attachments.map((item: any, i: number) => (
								<Attachment key={i} object={item} onRemove={() => this.onAttachmentRemove(item.id)} />
							))}
						</div>
					) : ''}

					{hasReactions ? (
						<div className="reactions">
							{reactions.map((item: any, i: number) => (
								<Reaction key={i} {...item} />
							))}

							<Icon id="reaction-add" className="reactionAdd" onClick={this.onReactionAdd} tooltip={translate('blockChatReactionAdd')} />
						</div>
					) : ''}

					<div className="sub" onClick={() => onThread(id)}>
						{!isThread ? <div className="item">0 replies</div> : ''}
					</div>

				</div>

				{isLast ? (
					<div className="newMessages">
						<Label text={translate('blockChatNewMessages')} />
					</div>
				) : ''}
			</div>
		);
	};

	componentDidMount(): void {
		this.init();
	};

	componentDidUpdate (): void {
		this.init();
	};

	init () {
		const { rootId, id, renderLinks, renderMentions, renderObjects, renderEmoji } = this.props;
		const message = S.Chat.getMessage(rootId, id);
		const { marks, text } = message.data;

		renderLinks(this.node, marks, text);
		renderMentions(this.node, marks, text);
		renderObjects(this.node, marks, text);
		renderEmoji(this.node);

		this.checkLinesLimit();
	};

	onExpand () {
		this.isExpanded = true;
		this.forceUpdate();
	};

	checkLinesLimit () {
		const ref = $(this.refText);
		const textHeight = ref.outerHeight();
		const lineHeight = parseInt(ref.css('line-height'));

		if (textHeight / lineHeight > LINES_LIMIT) {
			this.canExpand = true;
			this.forceUpdate();
		};
	};

	onReactionEnter (e: any, authors: string[]) {
		const { space } = S.Common;

		const text = authors.map(it => {
			const author = U.Space.getParticipant(U.Space.getParticipantId(space, it));

			return author.name;
		}).filter(it => it).join('\n');

		Preview.tooltipShow({ text, element: $(e.currentTarget) });
	};

	onReactionLeave (e: any) {
		Preview.tooltipHide(false);
	};

	onReactionAdd () {
		const node = $(this.node);

		S.Menu.open('smile', { 
			element: node.find('#reaction-add'),
			horizontal: I.MenuDirection.Center,
			noFlipX: true,
			onOpen: () => node.addClass('hover'),
			onClose: () => node.removeClass('hover'),
			data: {
				noHead: true,
				noUpload: true,
				value: '',
				onSelect: icon => this.onReactionSelect(icon),
			}
		});
	};

	onReactionSelect (icon: string) {
		const { rootId, id } = this.props;
		const { account } = S.Auth;
		const message = S.Chat.getMessage(rootId, id);
		const reactions = message.data.reactions || [];
		const item = reactions.find(it => it.value == icon);
		const idx = reactions.findIndex(it => it.value == icon);

		if (!item) {
			reactions.push({ value: icon, authors: [ account.id ], count: 1 });
		} else {
			item.authors = item.authors || [];

			if (item.authors.includes(account.id)) {
				item.authors = item.authors.filter(id => id != account.id);
			} else {
				item.authors = item.authors.concat(account.id);
			};

			if (!item.authors.length) {
				reactions.splice(idx, 1);
			};
		};

		this.update({ ...message.data, reactions });
	};

	onAttachmentRemove (attachmentId: string) {
		const { rootId, id } = this.props;
		const message = S.Chat.getMessage(rootId, id);
		const attachments = (message.data.attachments || []).filter(it => it != attachmentId);

		this.update({ ...message.data, attachments });
	};

	update (data: any) {
		const { rootId, id } = this.props;

		S.Chat.update(rootId, { id, data });
		C.ChatEditMessage(rootId, id, JSON.stringify(data));
	};

});

export default ChatMessage;