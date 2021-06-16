import protooClient from 'protoo-client';
import * as mediasoupClient from 'mediasoup-client';
import { getProtooUrl } from './urlFactory';
import * as stateActions from './redux/stateActions';
import * as e2e from './e2e';

let store;

export default class RoomClient
{
	static init(data)
	{
		store = data.store;
	}

	constructor(
		{
			roomId,
			peerId,
			displayName,
			device,
			handlerName,
			forceTcp,
			produce,
			consume,
			datachannel,
			e2eKey
		}
	)
	{
		this._displayName = displayName;
		this._device = device;
		this._forceTcp = forceTcp;
		this._produce = produce;
		this._consume = consume;
		this._useDataChannel = datachannel;
		this._e2eKey = e2eKey;
		this._handlerName = handlerName;
		this._protooUrl = getProtooUrl({ roomId, peerId });
		this._protoo = null;
		this._mediasoupDevice = null;
		this._sendTransport = null;
		this._recvTransport = null;
		this._micProducer = null;

		this._webcamProducer = null;

		this._consumers = new Map();
	}

	async join()
	{
		const protooTransport = new protooClient.WebSocketTransport(this._protooUrl);

		this._protoo = new protooClient.Peer(protooTransport);

		store.dispatch(
			stateActions.setRoomState('connecting'));

		this._protoo.on('open', () => this._joinRoom());

		this._protoo.on('request', async (request, accept, reject) =>
		{
			switch (request.method)
			{
				case 'newConsumer':
				{
					const {
						peerId,
						producerId,
						id,
						kind,
						rtpParameters,
						type,
						appData,
						producerPaused
					} = request.data;

					const consumer = await this._recvTransport.consume(
						{
							id,
							producerId,
							kind,
							rtpParameters,
							appData : { ...appData, peerId } // Trick.
						});

					// Store in the map.
					this._consumers.set(consumer.id, consumer);

					store.dispatch(stateActions.addConsumer(
						{
							id             : consumer.id,
							type           : type,
							locallyPaused  : false,
							remotelyPaused : producerPaused,
							rtpParameters  : consumer.rtpParameters,
							priority       : 1,
							codec          : consumer.rtpParameters.codecs[0].mimeType.split('/')[1],
							track          : consumer.track
						},
						peerId));

					accept();

					break;
				}

				case 'newDataConsumer':
				{
					const {
						peerId, // NOTE: Null if bot.
						dataProducerId,
						id,
						sctpStreamParameters,
						label,
						protocol,
						appData
					} = request.data;

					const dataConsumer = await this._recvTransport.consumeData(
						{
							id,
							dataProducerId,
							sctpStreamParameters,
							label,
							protocol,
							appData : { ...appData, peerId } // Trick.
						});

					store.dispatch(stateActions.addDataConsumer(
						{
							id                   : dataConsumer.id,
							sctpStreamParameters : dataConsumer.sctpStreamParameters,
							label                : dataConsumer.label,
							protocol             : dataConsumer.protocol
						},
						peerId));

					accept();

					break;
				}
			}
		});

		this._protoo.on('notification', (notification) =>
		{
			switch (notification.method)
			{
				case 'producerScore':
				{
					const { producerId, score } = notification.data;

					store.dispatch(
						stateActions.setProducerScore(producerId, score));

					break;
				}

				case 'newPeer':
				{
					const peer = notification.data;

					store.dispatch(
						stateActions.addPeer(
							{ ...peer, consumers: [], dataConsumers: [] }));

					break;
				}

				case 'consumerScore':
				{
					const { consumerId, score } = notification.data;

					store.dispatch(
						stateActions.setConsumerScore(consumerId, score));

					break;
				}
			}
		});
	}

	async enableMic()
	{
		const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

		const track = stream.getAudioTracks()[0];

		this._micProducer = await this._sendTransport.produce(
			{
				track
			});

		store.dispatch(stateActions.addProducer(
			{
				id            : this._micProducer.id,
				paused        : this._micProducer.paused,
				track         : this._micProducer.track,
				rtpParameters : this._micProducer.rtpParameters,
				codec         : this._micProducer.rtpParameters.codecs[0].mimeType.split('/')[1]
			}));
	}

	async enableWebcam()
	{
		const devices = await navigator.mediaDevices.enumerateDevices();

		let webcam = null;

		for (const device of devices)
		{
			if (device.kind === 'videoinput')
			{
				webcam = device.deviceId;
				break;
			}
		}

		const stream = await navigator.mediaDevices.getUserMedia(
			{
				video :
				{
					deviceId : { ideal: webcam }
				}
			});

		const track = stream.getVideoTracks()[0];

		this._webcamProducer = await this._sendTransport.produce(
			{
				track
			});

		store.dispatch(stateActions.addProducer(
			{
				id            : this._webcamProducer.id,
				deviceLabel   : 'webcam label',
				type          : 'front',
				paused        : this._webcamProducer.paused,
				track         : this._webcamProducer.track,
				rtpParameters : this._webcamProducer.rtpParameters,
				codec         : this._webcamProducer.rtpParameters.codecs[0].mimeType.split('/')[1]
			}));
	}

	async _joinRoom()
	{
		this._mediasoupDevice = new mediasoupClient.Device(
			{
				handlerName : this._handlerName
			});

		const routerRtpCapabilities =
			await this._protoo.request('getRouterRtpCapabilities');

		await this._mediasoupDevice.load({ routerRtpCapabilities });

		// Create mediasoup Transport for sending (unless we don't want to produce).
		if (this._produce)
		{
			const transportInfo = await this._protoo.request(
				'createWebRtcTransport',
				{
					forceTcp         : this._forceTcp,
					producing        : true,
					consuming        : false,
					sctpCapabilities : this._useDataChannel
						? this._mediasoupDevice.sctpCapabilities
						: undefined
				});

			const {
				id,
				iceParameters,
				iceCandidates,
				dtlsParameters,
				sctpParameters
			} = transportInfo;

			this._sendTransport = this._mediasoupDevice.createSendTransport(
				{
					id,
					iceParameters,
					iceCandidates,
					dtlsParameters,
					sctpParameters
				});

			this._sendTransport.on(
				'connect', ({ dtlsParameters }, callback, errback) => // eslint-disable-line no-shadow
				{
					this._protoo.request(
						'connectWebRtcTransport',
						{
							transportId : this._sendTransport.id,
							dtlsParameters
						})
						.then(callback);
				});

			this._sendTransport.on(
				'produce', async ({ kind, rtpParameters, appData }, callback, errback) =>
				{
					try
					{
						// eslint-disable-next-line no-shadow
						const { id } = await this._protoo.request(
							'produce',
							{
								transportId : this._sendTransport.id,
								kind,
								rtpParameters,
								appData
							});

						callback({ id });
					}
					catch (error)
					{
						errback(error);
					}
				});

			this._sendTransport.on('producedata', async (
				{
					sctpStreamParameters,
					label,
					protocol,
					appData
				},
				callback,
				errback
			) =>
			{
				try
				{
					const { id } = await this._protoo.request(
						'produceData',
						{
							transportId : this._sendTransport.id,
							sctpStreamParameters,
							label,
							protocol,
							appData
						});

					callback({ id });
				}
				catch (error)
				{
					errback(error);
				}
			});
		}

		if (this._consume)
		{
			const transportInfo = await this._protoo.request(
				'createWebRtcTransport',
				{
					forceTcp         : this._forceTcp,
					producing        : false,
					consuming        : true,
					sctpCapabilities : this._useDataChannel
						? this._mediasoupDevice.sctpCapabilities
						: undefined
				});

			const {
				id,
				iceParameters,
				iceCandidates,
				dtlsParameters,
				sctpParameters
			} = transportInfo;

			this._recvTransport = this._mediasoupDevice.createRecvTransport(
				{
					id,
					iceParameters,
					iceCandidates,
					dtlsParameters,
					sctpParameters,
					iceServers 	       : [],
					additionalSettings :
						{ encodedInsertableStreams: this._e2eKey && e2e.isSupported() }
				});

			this._recvTransport.on(
				'connect', ({ dtlsParameters }, callback, errback) => // eslint-disable-line no-shadow
				{
					this._protoo.request(
						'connectWebRtcTransport',
						{
							transportId : this._recvTransport.id,
							dtlsParameters
						})
						.then(callback)
						.catch(errback);
				});
		}

		const { peers } = await this._protoo.request(
			'join',
			{
				displayName     : this._displayName,
				device          : this._device,
				rtpCapabilities : this._consume
					? this._mediasoupDevice.rtpCapabilities
					: undefined,
				sctpCapabilities : this._useDataChannel && this._consume
					? this._mediasoupDevice.sctpCapabilities
					: undefined
			});

		for (const peer of peers)
		{
			store.dispatch(
				stateActions.addPeer(
					{ ...peer, consumers: [], dataConsumers: [] }));
		}

		// Enable mic/webcam.
		if (this._produce)
		{
			this.enableMic();
			this.enableWebcam();
		}
	}
}
