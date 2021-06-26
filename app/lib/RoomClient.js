import * as mediasoupClient from 'mediasoup-client';
import {generateRandomNumber} from "mediasoup-client/lib/utils";

let store;

export default class RoomClient {
    static init(data) {
        store = data.store;
    }

    constructor(
        {
            peerId
        }
    ) {
        this.url = "wss://172.18.51.152:4443/?roomId=0&peerId=" + peerId;
        this.socket = null;
        this.callbacks = [];
        this._mediasoupDevice = null;
        this._sendTransport = null;
        this._recvTransport = null;
    }

    async join() {
        this.socket = new WebSocket(this.url, "protoo");

        const self = this;
        this.socket.onopen = () => {
            self._joinRoom()
        };

        this.socket.onmessage = function (event) {
            const eventData = JSON.parse(event.data)

            switch (eventData.method) {
                case 'newConsumer': {
                    const {
                        peerId,
                        producerId,
                        id,
                        kind,
                        rtpParameters,
                        appData
                    } = eventData.data;

                    self._recvTransport.consume(
                        {
                            id,
                            producerId,
                            kind,
                            rtpParameters,
                            appData: {...appData, peerId}
                        }).then((consumer) => {

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

                        // accept();

                    });

                    break;
                }
            }

            const callback = self.callbacks[eventData.id];
            if (callback !== undefined) {
                callback(eventData);
            }
        };
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

    _joinRoom() {
        this._mediasoupDevice = new mediasoupClient.Device();

        const message = {
            request: true,
            id: generateRandomNumber(),
            method: "getRouterRtpCapabilities",
            data: {}
        };

        this.sendRequest(message, (response) => {
            const routerRtpCapabilities = response.data;
            this._mediasoupDevice.load({routerRtpCapabilities});

            const message = {
                request: true,
                id: generateRandomNumber(),
                method: "createWebRtcTransport",
                data: {
                    "producing": true
                }
            };
            this.sendRequest(message, (response) => {
                const producerTransportInfo = response.data;
                this._sendTransport = this._mediasoupDevice.createSendTransport(producerTransportInfo);

                this._sendTransport.on(
                    'connect', ({dtlsParameters}, callback) => {
                        const message = {
                            request: true,
                            id: generateRandomNumber(),
                            method: "connectWebRtcTransport",
                            data: {
                                "transportId": this._sendTransport.id,
                                dtlsParameters
                            }
                        };
                        this.sendRequest(message, () => {
                            callback();
                        });
                    });

                this._sendTransport.on(
                    'produce', async ({kind, rtpParameters, appData}, callback) => {
                        const message = {
                            request: true,
                            id: generateRandomNumber(),
                            method: "produce",
                            data: {
                                "transportId": this._sendTransport.id,
                                kind,
                                rtpParameters,
                                appData
                            }
                        };
                        this.sendRequest(message, (response) => {
                            const {id} = response.data;

                            callback(id);
                        });
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
                    const message = {
                        "request": true,
                        "id": generateRandomNumber(),
                        "method": "produceData",
                        "data": {
                            "transportId": this._sendTransport.id,
                            sctpStreamParameters,
                            label,
                            protocol,
                            appData
                        }
                    };
                    this.sendRequest(message, (response) => {
                        const {id} = response.data;

                        callback({id});
                    });
                });

                const message = {
                    "request": true,
                    "id": generateRandomNumber(),
                    "method": "createWebRtcTransport",
                    "data": {
                        "consuming": true
                    }
                };
                this.sendRequest(message, (response) => {
                    const consumerTransportInfo = response.data;
                    this._recvTransport = this._mediasoupDevice.createRecvTransport(consumerTransportInfo);

                    this._recvTransport.on(
                        'connect', ({dtlsParameters}, callback) => {
                            const message = {
                                "request": true,
                                "id": generateRandomNumber(),
                                "method": "connectWebRtcTransport",
                                "data": {
                                    "transportId": this._recvTransport.id,
                                    dtlsParameters
                                }
                            }
                            this.sendRequest(message, () => {
                                callback();
                            });
                        });

                    const message = {
                        "request": true,
                        "id": generateRandomNumber(),
                        "method": "join",
                        "data": {
                            "rtpCapabilities": this._mediasoupDevice.rtpCapabilities
                        }
                    };
                    this.sendRequest(message, (response) => {
                        const {peers} = response.data;

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

                        this.enableStreams();
                    });
                });
            });
        });
    }

    sendRequest(message, callback) {
        this.callbacks[message.id] = callback;

        const json = JSON.stringify(message);
        this.socket.send(json);
    }
}
