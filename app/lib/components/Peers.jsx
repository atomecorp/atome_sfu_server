import React from 'react';
import Peer from './Peer';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';
import * as appPropTypes from './appPropTypes';

const Peers = ({ peers }) =>
{
	return (
		<div data-component='Peers'>
			{
				peers.map((peer) =>
				{
					return (
						<Peer id={peer.id} />
					);
				})
			}
		</div>
	);
};

Peers.propTypes =
{
	peers : PropTypes.arrayOf(appPropTypes.Peer)
};

const mapStateToProps = (state) =>
{
	return {
		peers : Object.values(state.peers)
	};
};

const PeersContainer = connect(
	mapStateToProps
)(Peers);

export default PeersContainer;
