const initialState = {};

const consumers = (state = initialState, action) =>
{
	switch (action.type)
	{
		case 'ADD_CONSUMER':
		{
			const { consumer } = action.payload;

			return { ...state, [consumer.id]: consumer };
		}

		case 'SET_CONSUMER_SCORE':
		{
			const { consumerId, score } = action.payload;
			const consumer = state[consumerId];

			if (!consumer)
				return state;

			const newConsumer = { ...consumer, score };

			return { ...state, [consumerId]: newConsumer };
		}

		default:
		{
			return state;
		}
	}
};

export default consumers;
