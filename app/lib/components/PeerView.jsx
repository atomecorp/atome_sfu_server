import React from 'react';
import PropTypes from 'prop-types';
import classnames from 'classnames';
import * as appPropTypes from './appPropTypes';

export default class PeerView extends React.Component
{
	constructor(props)
	{
		super(props);

		this.state =
		{
			videoCanPlay    : false,
			videoElemPaused : false,
			maxSpatialLayer : null
		};

		this._audioTrack = null;
		this._videoTrack = null;
	}

	render()
	{
		const {
			isMe
		} = this.props;

		return (
			<div data-component='PeerView'>
				<video
					ref='videoElem'
					className={classnames({
						'is-me'         : isMe
					})}
					autoPlay
					playsInline
					muted
					controls={false}
				/>

				<audio
					ref='audioElem'
					autoPlay
					playsInline
					muted={isMe}
					controls={false}
				/>
			</div>
		);
	}

	componentWillUpdate()
	{
		const {
			isMe,
			audioTrack,
			videoTrack,
			videoRtpParameters
		} = this.props;

		const { maxSpatialLayer } = this.state;

		if (isMe && videoRtpParameters && maxSpatialLayer === null)
		{
			this.setState(
				{
					maxSpatialLayer : videoRtpParameters.encodings.length - 1
				});
		}
		else if (isMe && !videoRtpParameters && maxSpatialLayer !== null)
		{
			this.setState({ maxSpatialLayer: null });
		}

		if (this._audioTrack === audioTrack && this._videoTrack === videoTrack)
			return;

		this._audioTrack = audioTrack;
		this._videoTrack = videoTrack;

		const { audioElem, videoElem } = this.refs;

		const audioStream = new MediaStream;

		audioStream.addTrack(audioTrack);
		audioElem.srcObject = audioStream;

		audioElem.play();

		const videoStream = new MediaStream;

		videoStream.addTrack(videoTrack);
		videoElem.srcObject = videoStream;

		videoElem.oncanplay = () => this.setState({ videoCanPlay: true });

		videoElem.onplay = () =>
		{
			this.setState({ videoElemPaused: false });

			audioElem.play();
		};

		videoElem.onpause = () => this.setState({ videoElemPaused: true });

		videoElem.play();
	}
}

PeerView.propTypes =
{
	isMe : PropTypes.bool,
	peer : PropTypes.oneOfType(
		[ appPropTypes.Me, appPropTypes.Peer ]).isRequired,
	videoVisible       : PropTypes.bool.isRequired,
	audioTrack         : PropTypes.any,
	videoTrack         : PropTypes.any,
	videoRtpParameters : PropTypes.any
};
