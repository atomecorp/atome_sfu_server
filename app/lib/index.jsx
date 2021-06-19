import domready from 'domready';
import React from 'react';
import { render } from 'react-dom';
import { Provider } from 'react-redux';
import {
	createStore as createReduxStore
} from 'redux';

import randomString from 'random-string';
import RoomClient from './RoomClient';
import RoomContext from './RoomContext';
import reducers from './redux/reducers';
import Peers from './components/Peers';

let roomClient;
const store = createReduxStore(
	reducers
);

RoomClient.init({ store });

domready(async () =>
{
	const peerId = randomString({ length: 8 }).toLowerCase();

	roomClient = new RoomClient(
		{
			roomId : 0,
			peerId
		});

	render(
		<Provider store={store}>
			<RoomContext.Provider value={roomClient}>
				<div data-component='Room'>
					<Peers />
				</div>
			</RoomContext.Provider>
		</Provider>,
		document.getElementById('mediasoup-demo-app-container')
	);

	roomClient.join();
});
