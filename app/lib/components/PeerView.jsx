import React from 'react';
import PropTypes from 'prop-types';

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
		return (
			<div data-component='PeerView'>
				<video
					ref='videoElem'
					autoPlay
					playsInline
					muted
					controls={false}
				/>

				<audio
					ref='audioElem'
					autoPlay
					playsInline
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
	audioTrack : PropTypes.any,
	videoTrack : PropTypes.any
};
