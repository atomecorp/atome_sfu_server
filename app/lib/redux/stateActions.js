export const addProducer = (producer) =>
{
	return {
		type    : 'ADD_PRODUCER',
		payload : { producer }
	};
};

export const setProducerScore = (producerId, score) =>
{
	return {
		type    : 'SET_PRODUCER_SCORE',
		payload : { producerId, score }
	};
};

export const addPeer = (peer) =>
{
	return {
		type    : 'ADD_PEER',
		payload : { peer }
	};
};

export const addConsumer = (consumer, peerId) =>
{
	return {
		type    : 'ADD_CONSUMER',
		payload : { consumer, peerId }
	};
};

export const setConsumerScore = (consumerId, score) =>
{
	return {
		type    : 'SET_CONSUMER_SCORE',
		payload : { consumerId, score }
	};
};

export const addNotification = (notification) =>
{
	return {
		type    : 'ADD_NOTIFICATION',
		payload : { notification }
	};
};

export const removeNotification = (notificationId) =>
{
	return {
		type    : 'REMOVE_NOTIFICATION',
		payload : { notificationId }
	};
};
