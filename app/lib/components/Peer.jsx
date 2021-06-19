import React from 'react';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';
import * as appPropTypes from './appPropTypes';
import { withRoomContext } from '../RoomContext';
import PeerView from './PeerView';

const Peer = (props) =>
{
	const {
		peer,
		audioConsumer,
		videoConsumer
	} = props;

	return (
		<div data-component='Peer'>
			<PeerView
				peer={peer}
				audioConsumerId={audioConsumer ? audioConsumer.id : null}
				videoConsumerId={videoConsumer ? videoConsumer.id : null}
				audioRtpParameters={audioConsumer ? audioConsumer.rtpParameters : null}
				videoRtpParameters={videoConsumer ? videoConsumer.rtpParameters : null}
				audioTrack={audioConsumer ? audioConsumer.track : null}
				videoTrack={videoConsumer ? videoConsumer.track : null}
			/>
		</div>
	);
};

Peer.propTypes =
{
	roomClient    : PropTypes.any.isRequired,
	peer          : appPropTypes.Peer.isRequired,
	audioConsumer : appPropTypes.Consumer,
	videoConsumer : appPropTypes.Consumer
};

const mapStateToProps = (state, { id }) =>
{
	const peer = state.peers[id];
	const consumersArray = peer.consumers
		.map((consumerId) => state.consumers[consumerId]);
	const audioConsumer =
		consumersArray.find((consumer) => consumer.track.kind === 'audio');
	const videoConsumer =
		consumersArray.find((consumer) => consumer.track.kind === 'video');

	return {
		peer,
		audioConsumer,
		videoConsumer
	};
};

const PeerContainer = withRoomContext(connect(
	mapStateToProps
)(Peer));

export default PeerContainer;
