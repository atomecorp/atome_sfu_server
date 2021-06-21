import { combineReducers } from 'redux';
import peers from './peers';
import consumers from './consumers';

const reducers = combineReducers(
	{
		peers,
		consumers
	});

export default reducers;
