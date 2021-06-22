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

		default:
		{
			return state;
		}
	}
};

export default consumers;
