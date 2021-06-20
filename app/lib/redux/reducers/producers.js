const initialState = {};

const producers = (state = initialState, action) =>
{
	switch (action.type)
	{
		case 'ADD_PRODUCER':
		{
			const { producer } = action.payload;

			return { ...state, [producer.id]: producer };
		}

		case 'SET_PRODUCER_SCORE':
		{
			const { producerId, score } = action.payload;
			const producer = state[producerId];

			if (!producer)
				return state;

			const newProducer = { ...producer, score };

			return { ...state, [producerId]: newProducer };
		}

		default:
		{
			return state;
		}
	}
};

export default producers;
