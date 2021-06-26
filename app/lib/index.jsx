import domready from 'domready';
import React from 'react';
import {render} from 'react-dom';
import {Provider} from 'react-redux';
import {createStore as createReduxStore} from 'redux';

import RoomClient from './RoomClient';
import reducers from './redux/reducers';
import App from './components/App';
import randomString from "random-string";

let roomClient;
const store = createReduxStore(
    reducers
);

RoomClient.init({store});

domready(async () => {
    roomClient = new RoomClient(
        {
            peerId: randomString()
        });

    render(
        <Provider store={store}>
            <div data-component='Room'>
                <App/>
            </div>
        </Provider>,
        document.getElementById('mediasoup-demo-app-container')
    );

    await roomClient.join();
});
