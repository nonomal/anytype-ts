import * as amplitude from 'amplitude-js';
import { blockStore } from 'ts/store';
import { I, M, Util } from 'ts/lib';

const Constant = require('json/constant.json');

class Analytics {
	
	isInit: boolean =  false;
	
	init () {
		console.log('[Analytics.init]', Constant.amplitude);
		amplitude.getInstance().init(Constant.amplitude, null, {
			batchEvents: true,
			saveEvents: true,
			includeUtm: true,
			includeReferrer: true,
		});
		this.isInit = true;
	};
	
	profile (profile: any) {
		console.log('[Analytics.profile]', profile.id);
		amplitude.getInstance().setUserId(profile.id);
	};
	
	setUserProperties (obj: any) {
		console.log('[Analytics.setUserProperties]', obj);
		amplitude.getInstance().setUserProperties(obj);
	};
	
	getDictionary (type: string, style: number) {
		let data: any = {
			text: {},
			file: {},
			div: {},
		};
		
		data.text[I.TextStyle.Paragraph]	 = 'Paragraph';
		data.text[I.TextStyle.Header1]		 = 'Header1';
		data.text[I.TextStyle.Header2]		 = 'Header2';
		data.text[I.TextStyle.Header3]		 = 'Header3';
		data.text[I.TextStyle.Quote]		 = 'Quote';
		data.text[I.TextStyle.Code]			 = 'Code';
		data.text[I.TextStyle.Bulleted]		 = 'Bulleted';
		data.text[I.TextStyle.Numbered]		 = 'Numbered';
		data.text[I.TextStyle.Toggle]		 = 'Toggle';
		data.text[I.TextStyle.Checkbox]		 = 'Checkbox';
		
		data.file[I.FileType.None]			 = 'None';
		data.file[I.FileType.File]			 = 'File';
		data.file[I.FileType.Image]			 = 'Image';
		data.file[I.FileType.Video]			 = 'Video';
		
		data.div[I.DivStyle.Line]			 = 'Line';
		data.div[I.DivStyle.Dot]			 = 'Dot';

		return data[type][style];
	};
	
	event (code: string, data?: any) {
		if (!code || !this.isInit) {
			return;
		};
		
		let param: any = {};
		
		switch (code) {
			case 'BlockCreate':
			case 'BlockReplace':
				let block = new M.Block(blockStore.prepareBlockFromProto(data.block));
				
				param.type = block.type;
				if (block.isText() || block.isDiv()) {
					param.style = this.getDictionary(block.type, block.content.style);
				};
				if (block.isFile()) {
					param.style = this.getDictionary(block.type, block.content.type);
				};
				break;
				
			case 'BlockListSetTextStyle':
				param.style = this.getDictionary(I.BlockType.Text, data.style);
				break;
		};
		
		console.log('[Analytics.event]', code, param);
		amplitude.getInstance().logEvent(code, param);
	};
	
};

export let analytics: Analytics = new Analytics();