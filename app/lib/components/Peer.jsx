import React from 'react';
import {connect} from 'react-redux';
import PeerView from './PeerView';

const Peer = ({audioConsumer, videoConsumer}) => {
    return (
        <div data-component='Peer'>
            <PeerView
                audioTrack={audioConsumer ? audioConsumer.track : null}
                videoTrack={videoConsumer ? videoConsumer.track : null}
            />
        </div>
    );
};

export default connect(
    (state, {id}) => {
        const peer = state.peers[id];

        const consumersArray = peer.consumers
            .map((consumerId) => state.consumers[consumerId]);

        const audioConsumer =
            consumersArray.find((consumer) => consumer.track.kind === 'audio');
        const videoConsumer =
            consumersArray.find((consumer) => consumer.track.kind === 'video');

        return {
            audioConsumer,
            videoConsumer
        };
    }
)(Peer);
;
