const initialState = {};

const peers = (state = initialState, action) =>
{
	switch (action.type)
	{
		case 'ADD_PEER':
		{
			const { peer } = action.payload;

			return { ...state, [peer.id]: peer };
		}

		case 'ADD_CONSUMER':
		{
			const { consumer, peerId } = action.payload;
			const peer = state[peerId];

			if (!peer)
				throw new Error('no Peer found for new Consumer');

			const newConsumers = [ ...peer.consumers, consumer.id ];
			const newPeer = { ...peer, consumers: newConsumers };

			return { ...state, [newPeer.id]: newPeer };
		}

		default:
		{
			return state;
		}
	}
};

export default peers;
