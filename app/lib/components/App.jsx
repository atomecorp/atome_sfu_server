import React, {Component} from 'react';
import {connect} from 'react-redux';

class App extends Component {
    render() {
        return (
            <div data-component='App'>
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

    componentWillUpdate(nextProps, nextState) {
        const {
            audioTrack,
            videoTrack
        } = nextProps;

        const {audioElem, videoElem} = this.refs;

        if (audioTrack) {
            console.log("Setting audio track.");

            const stream = new MediaStream;

            stream.addTrack(audioTrack);
            audioElem.srcObject = stream;

            audioElem.play();

            console.log("Audio track set.");
        }

        if (videoTrack) {
            console.log("Setting video track.");

            const stream = new MediaStream;

            stream.addTrack(videoTrack);
            videoElem.srcObject = stream;

            videoElem.play();

            console.log("video track set.");
        }
    }
}

export default connect(
    (state) => {
        const peers = Object.values(state.peers);

        if(peers.length > 0) {
            const peer = peers[0];
            const consumersArray = peer.consumers
                .map((consumerId) => state.consumers[consumerId]);

            const audioConsumer =
                consumersArray.find((consumer) => consumer.track.kind === 'audio');
            const videoConsumer =
                consumersArray.find((consumer) => consumer.track.kind === 'video');

            const audioTrack = audioConsumer ? audioConsumer.track : null;
            const videoTrack = videoConsumer ? videoConsumer.track : null;

            console.log("connect audioTrack: " + audioTrack);
            console.log("connect videoTrack: " + videoTrack);

            return {
                audioTrack,
                videoTrack
            };
        }

        return {};
    }
)(App);
