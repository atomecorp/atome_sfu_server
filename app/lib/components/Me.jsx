import React from 'react';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';
import ReactTooltip from 'react-tooltip';
import classnames from 'classnames';
import * as cookiesManager from '../cookiesManager';
import * as appPropTypes from './appPropTypes';
import { withRoomContext } from '../RoomContext';
import * as stateActions from '../redux/stateActions';
import PeerView from './PeerView';

class Me extends React.Component
{
	constructor(props)
	{
		super(props);

		this._rootNode = null;
	}

	render()
	{
		const {
			roomClient,
			me,
			audioProducer,
			videoProducer
		} = this.props;

		const micState = 'on';
		const webcamState = 'on';
		const changeWebcamState = 'on';
		const shareState = 'on';
		const videoVisible = true;

		return (
			<div
				data-component='Me'
				ref={(node) => (this._rootNode = node)}
			>
				<PeerView
					isMe
					peer={me}
					audioProducerId={audioProducer ? audioProducer.id : null}
					videoProducerId={videoProducer ? videoProducer.id : null}
					audioRtpParameters={audioProducer ? audioProducer.rtpParameters : null}
					videoRtpParameters={videoProducer ? videoProducer.rtpParameters : null}
					audioTrack={audioProducer ? audioProducer.track : null}
					videoTrack={videoProducer ? videoProducer.track : null}
					videoVisible={videoVisible}
					audioCodec={audioProducer ? audioProducer.codec : null}
					videoCodec={videoProducer ? videoProducer.codec : null}
					audioScore={audioProducer ? audioProducer.score : null}
					videoScore={videoProducer ? videoProducer.score : null}
					onChangeDisplayName={(displayName) =>
					{
						roomClient.changeDisplayName(displayName);
					}}
					onChangeMaxSendingSpatialLayer={(spatialLayer) =>
					{
						roomClient.setMaxSendingSpatialLayer(spatialLayer);
					}}
				/>
			</div>
		);
	}
}

Me.propTypes =
{
	roomClient    : PropTypes.any.isRequired,
	me            : appPropTypes.Me.isRequired,
	audioProducer : appPropTypes.Producer,
	videoProducer : appPropTypes.Producer
};

const mapStateToProps = (state) =>
{
	const producersArray = Object.values(state.producers);
	const audioProducer =
		producersArray.find((producer) => producer.track.kind === 'audio');
	const videoProducer =
		producersArray.find((producer) => producer.track.kind === 'video');

	return {
		me            : state.me,
		audioProducer : audioProducer,
		videoProducer : videoProducer
	};
};

const MeContainer = withRoomContext(connect(
	mapStateToProps
)(Me));

export default MeContainer;
