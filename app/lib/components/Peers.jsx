import React from 'react';
import Peer from './Peer';
import { connect } from 'react-redux';

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

const PeersContainer = connect(
	(state) =>
	{
		return {
			peers : Object.values(state.peers)
		};
	}
)(Peers);

export default PeersContainer;
