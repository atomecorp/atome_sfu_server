import React from 'react';
import PropTypes from 'prop-types';
import classnames from 'classnames';

export default class PeerView extends React.Component
{
	constructor(props)
	{
		super(props);

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
						'is-me' : isMe
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
			audioTrack,
			videoTrack
		} = this.props;

		if (this._audioTrack === audioTrack && this._videoTrack === videoTrack)
			return;

		this._audioTrack = audioTrack;
		this._videoTrack = videoTrack;

		const { audioElem, videoElem } = this.refs;

		if (audioTrack)
		{
			const stream = new MediaStream;

			stream.addTrack(audioTrack);
			audioElem.srcObject = stream;

			audioElem.play();
		}

		if (videoTrack)
		{
			const stream = new MediaStream;

			stream.addTrack(videoTrack);
			videoElem.srcObject = stream;

			videoElem.play();
		}
	}
}

PeerView.propTypes =
{
	isMe       : PropTypes.bool,
	audioTrack : PropTypes.any,
	videoTrack : PropTypes.any
};
