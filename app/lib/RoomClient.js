import protooClient from 'protoo-client';
import * as mediasoupClient from 'mediasoup-client';
import {getProtooUrl} from './urlFactory';

let store;

export default class RoomClient {
    static init(data) {
        store = data.store;
    }

    constructor(
        {
            roomId,
            peerId
        }
    ) {
        this._protooUrl = getProtooUrl({roomId, peerId});
        this._protoo = null;
        this._mediasoupDevice = null;
        this._sendTransport = null;
        this._recvTransport = null;
    }

    async join() {
        const protooTransport = new protooClient.WebSocketTransport(this._protooUrl);

        this._protoo = new protooClient.Peer(protooTransport);

        this._protoo.on('open', () => this._joinRoom());

        this._protoo.on('request', async (request, accept) => {
            switch (request.method) {
                case 'newConsumer': {
                    const {
                        peerId,
                        producerId,
                        id,
                        kind,
                        rtpParameters,
                        appData
                    } = request.data;

                    const consumer = await this._recvTransport.consume(
                        {
                            id,
                            producerId,
                            kind,
                            rtpParameters,
                            appData: {...appData, peerId}
                        });

                    store.dispatch({
                        type: 'ADD_CONSUMER',
                        payload: {
                            consumer: {
                                id: consumer.id,
                                track: consumer.track
                            },
                            peerId
                        }
                    });

                    accept();

                    break;
                }
            }
        });
    }

    async enableStreams() {
        const audiosStream = await navigator.mediaDevices.getUserMedia({audio: true});
        const videoStream = await navigator.mediaDevices.getUserMedia({video: true});

        const audioTrack = audiosStream.getAudioTracks()[0];
        const videoTrack = videoStream.getVideoTracks()[0];

        await this._sendTransport.produce(
            {
                track: audioTrack
            });

        await this._sendTransport.produce(
            {
                track: videoTrack
            });
    }

    async _joinRoom() {
        this._mediasoupDevice = new mediasoupClient.Device();

        const routerRtpCapabilities = await this._protoo.request('getRouterRtpCapabilities');

        await this._mediasoupDevice.load({routerRtpCapabilities});

        const producerTransportInfo = await this._protoo.request(
            'createWebRtcTransport',
            {
                producing: true
            });

        this._sendTransport = this._mediasoupDevice.createSendTransport(producerTransportInfo);

        this._sendTransport.on(
            'connect', ({dtlsParameters}, callback) => {
                this._protoo.request(
                    'connectWebRtcTransport',
                    {
                        transportId: this._sendTransport.id,
                        dtlsParameters
                    })
                    .then(callback);
            });

        this._sendTransport.on(
            'produce', async ({kind, rtpParameters, appData}, callback) => {
                const {id} = await this._protoo.request(
                    'produce',
                    {
                        transportId: this._sendTransport.id,
                        kind,
                        rtpParameters,
                        appData
                    });

                callback({id});
            });

        this._sendTransport.on('producedata', async (
            {
                sctpStreamParameters,
                label,
                protocol,
                appData
            },
            callback
        ) => {
            const {id} = await this._protoo.request(
                'produceData',
                {
                    transportId: this._sendTransport.id,
                    sctpStreamParameters,
                    label,
                    protocol,
                    appData
                });

            callback({id});
        });

        const consumerTransportInfo = await this._protoo.request(
            'createWebRtcTransport',
            {
                consuming: true
            });

        this._recvTransport = this._mediasoupDevice.createRecvTransport(consumerTransportInfo);

        this._recvTransport.on(
            'connect', ({dtlsParameters}, callback) => {
                this._protoo.request(
                    'connectWebRtcTransport',
                    {
                        transportId: this._recvTransport.id,
                        dtlsParameters
                    })
                    .then(callback);
            });

        const {peers} = await this._protoo.request(
            'join',
            {
                rtpCapabilities: this._mediasoupDevice.rtpCapabilities
            });

        for (const peer of peers) {
            store.dispatch(
                {
                    type: 'ADD_PEER',
                    payload: {
                        peer: {
                            ...peer,
                            consumers: [],
                            dataConsumers: []
                        }
                    }
                });
        }

        await this.enableStreams();
    }
}
