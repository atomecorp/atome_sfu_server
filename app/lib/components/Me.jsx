import React from 'react';
import { connect } from 'react-redux';
import * as appPropTypes from './appPropTypes';
import { withRoomContext } from '../RoomContext';

class Me extends React.Component
{
	constructor(props)
	{
		super(props);
	}

	render()
	{
		return (<div />);
	}
}

Me.propTypes =
{
	me : appPropTypes.Me.isRequired
};

const mapStateToProps = (state) =>
{
	return {
		me : state.me
	};
};

const MeContainer = withRoomContext(connect(
	mapStateToProps
)(Me));

export default MeContainer;
