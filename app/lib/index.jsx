import domready from 'domready';
import React from 'react';
import { render } from 'react-dom';
import { Provider } from 'react-redux';
import {
	createStore as createReduxStore
} from 'redux';

import RoomClient from './RoomClient';
import reducers from './redux/reducers';
import Peers from './components/Peers';
import randomString from "random-string";

let roomClient;
const store = createReduxStore(
	reducers
);

RoomClient.init({ store });

domready(async () =>
{
	roomClient = new RoomClient(
		{
			roomId : 0,
			peerId : randomString()
		});

	render(
		<Provider store={store}>
			<div data-component='Room'>
				<Peers />
			</div>
		</Provider>,
		document.getElementById('mediasoup-demo-app-container')
	);

	roomClient.join();
});
