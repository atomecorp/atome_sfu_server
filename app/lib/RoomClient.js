import protooClient from 'protoo-client';
import * as mediasoupClient from 'mediasoup-client';
import Logger from './Logger';
import { getProtooUrl } from './urlFactory';
import * as cookiesManager from './cookiesManager';
import * as requestActions from './redux/requestActions';
import * as stateActions from './redux/stateActions';
import * as e2e from './e2e';

const VIDEO_CONSTRAINS =
{
	qvga : { width: { ideal: 320 }, height: { ideal: 240 } },
	vga  : { width: { ideal: 640 }, height: { ideal: 480 } },
	hd   : { width: { ideal: 1280 }, height: { ideal: 720 } }
};

const PC_PROPRIETARY_CONSTRAINTS =
{
	optional : [ { googDscp: true } ]
};

// Used for simulcast webcam video.
const WEBCAM_SIMULCAST_ENCODINGS =
[
	{ scaleResolutionDownBy: 4, maxBitrate: 500000 },
	{ scaleResolutionDownBy: 2, maxBitrate: 1000000 },
	{ scaleResolutionDownBy: 1, maxBitrate: 5000000 }
];

// Used for VP9 webcam video.
const WEBCAM_KSVC_ENCODINGS =
[
	{ scalabilityMode: 'S3T3_KEY' }
];

const logger = new Logger('RoomClient');

let store;

export default class RoomClient
{
	/**
	 * @param  {Object} data
	 * @param  {Object} data.store - The Redux store.
	 */
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
			useSimulcast,
			useSharingSimulcast,
			forceTcp,
			produce,
			consume,
			forceH264,
			forceVP9,
			svc,
			datachannel,
			externalVideo,
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
		this._forceH264 = Boolean(forceH264);
		this._forceVP9 = Boolean(forceVP9);
		this._externalVideo = null;
		this._e2eKey = e2eKey;
		this._externalVideoStream = null;
		this._nextDataChannelTestNumber = 0;
		this._handlerName = handlerName;
		this._useSimulcast = useSimulcast;
		this._protooUrl = getProtooUrl({ roomId, peerId });
		this._protoo = null;
		this._mediasoupDevice = null;
		this._sendTransport = null;
		this._recvTransport = null;
		this._micProducer = null;

		this._webcamProducer = null;

		this._consumers = new Map();

		this._dataConsumers = new Map();

		this._webcams = new Map();
	}

	async join()
	{
		const protooTransport = new protooClient.WebSocketTransport(this._protooUrl);

		this._protoo = new protooClient.Peer(protooTransport);

		store.dispatch(
			stateActions.setRoomState('connecting'));

		this._protoo.on('open', () => this._joinRoom());

		this._protoo.on('failed', () =>
		{
			store.dispatch(requestActions.notify(
				{
					type : 'error',
					text : 'WebSocket connection failed'
				}));
		});

		this._protoo.on('request', async (request, accept, reject) =>
		{
			logger.debug(
				'proto "request" event [method:%s, data:%o]',
				request.method, request.data);

			switch (request.method)
			{
				case 'newConsumer':
				{
					if (!this._consume)
					{
						reject(403, 'I do not want to consume');

						break;
					}

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

					try
					{
						const consumer = await this._recvTransport.consume(
							{
								id,
								producerId,
								kind,
								rtpParameters,
								appData : { ...appData, peerId } // Trick.
							});

						if (this._e2eKey && e2e.isSupported())
						{
							e2e.setupReceiverTransform(consumer.rtpReceiver);
						}

						// Store in the map.
						this._consumers.set(consumer.id, consumer);

						const { spatialLayers, temporalLayers } =
							mediasoupClient.parseScalabilityMode(
								consumer.rtpParameters.encodings[0].scalabilityMode);

						store.dispatch(stateActions.addConsumer(
							{
								id                     : consumer.id,
								type                   : type,
								locallyPaused          : false,
								remotelyPaused         : producerPaused,
								rtpParameters          : consumer.rtpParameters,
								spatialLayers          : spatialLayers,
								temporalLayers         : temporalLayers,
								preferredSpatialLayer  : spatialLayers - 1,
								preferredTemporalLayer : temporalLayers - 1,
								priority               : 1,
								codec                  : consumer.rtpParameters.codecs[0].mimeType.split('/')[1],
								track                  : consumer.track
							},
							peerId));

						// We are ready. Answer the protoo request so the server will
						// resume this Consumer (which was paused for now if video).
						accept();

						// If audio-only mode is enabled, pause it.
						if (consumer.kind === 'video' && store.getState().me.audioOnly)
							this._pauseConsumer(consumer);
					}
					catch (error)
					{
						logger.error('"newConsumer" request failed:%o', error);

						store.dispatch(requestActions.notify(
							{
								type : 'error',
								text : `Error creating a Consumer: ${error}`
							}));

						throw error;
					}

					break;
				}

				case 'newDataConsumer':
				{
					if (!this._consume)
					{
						reject(403, 'I do not want to data consume');

						break;
					}

					if (!this._useDataChannel)
					{
						reject(403, 'I do not want DataChannels');

						break;
					}

					const {
						peerId, // NOTE: Null if bot.
						dataProducerId,
						id,
						sctpStreamParameters,
						label,
						protocol,
						appData
					} = request.data;

					try
					{
						const dataConsumer = await this._recvTransport.consumeData(
							{
								id,
								dataProducerId,
								sctpStreamParameters,
								label,
								protocol,
								appData : { ...appData, peerId } // Trick.
							});

						// Store in the map.
						this._dataConsumers.set(dataConsumer.id, dataConsumer);

						dataConsumer.on('open', () =>
						{
							logger.debug('DataConsumer "open" event');
						});

						dataConsumer.on('error', (error) =>
						{
							logger.error('DataConsumer "error" event:%o', error);

							store.dispatch(requestActions.notify(
								{
									type : 'error',
									text : `DataConsumer error: ${error}`
								}));
						});

						dataConsumer.on('message', (message) =>
						{
							logger.debug(
								'DataConsumer "message" event [streamId:%d]',
								dataConsumer.sctpStreamParameters.streamId);

							// TODO: For debugging.
							window.DC_MESSAGE = message;

							if (message instanceof ArrayBuffer)
							{
								const view = new DataView(message);
								const number = view.getUint32();

								if (number == Math.pow(2, 32) - 1)
								{
									logger.warn('dataChannelTest finished!');

									this._nextDataChannelTestNumber = 0;

									return;
								}

								if (number > this._nextDataChannelTestNumber)
								{
									logger.warn(
										'dataChannelTest: %s packets missing',
										number - this._nextDataChannelTestNumber);
								}

								this._nextDataChannelTestNumber = number + 1;

								return;
							}
							else if (typeof message !== 'string')
							{
								logger.warn('ignoring DataConsumer "message" (not a string)');

								return;
							}

							switch (dataConsumer.label)
							{
								case 'chat':
								{
									const { peers } = store.getState();
									const peersArray = Object.keys(peers)
										.map((_peerId) => peers[_peerId]);
									const sendingPeer = peersArray
										.find((peer) => peer.dataConsumers.includes(dataConsumer.id));

									if (!sendingPeer)
									{
										logger.warn('DataConsumer "message" from unknown peer');

										break;
									}

									store.dispatch(requestActions.notify(
										{
											title   : `${sendingPeer.displayName} says:`,
											text    : message,
											timeout : 5000
										}));

									break;
								}

								case 'bot':
								{
									store.dispatch(requestActions.notify(
										{
											title   : 'Message from Bot:',
											text    : message,
											timeout : 5000
										}));

									break;
								}
							}
						});

						// TODO: REMOVE
						window.DC = dataConsumer;

						store.dispatch(stateActions.addDataConsumer(
							{
								id                   : dataConsumer.id,
								sctpStreamParameters : dataConsumer.sctpStreamParameters,
								label                : dataConsumer.label,
								protocol             : dataConsumer.protocol
							},
							peerId));

						// We are ready. Answer the protoo request.
						accept();
					}
					catch (error)
					{
						logger.error('"newDataConsumer" request failed:%o', error);

						store.dispatch(requestActions.notify(
							{
								type : 'error',
								text : `Error creating a DataConsumer: ${error}`
							}));

						throw error;
					}

					break;
				}
			}
		});

		this._protoo.on('notification', (notification) =>
		{
			logger.debug(
				'proto "notification" event [method:%s, data:%o]',
				notification.method, notification.data);

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

					store.dispatch(requestActions.notify(
						{
							text : `${peer.displayName} has joined the room`
						}));

					break;
				}

				case 'peerDisplayNameChanged':
				{
					const { peerId, displayName, oldDisplayName } = notification.data;

					store.dispatch(
						stateActions.setPeerDisplayName(displayName, peerId));

					store.dispatch(requestActions.notify(
						{
							text : `${oldDisplayName} is now ${displayName}`
						}));

					break;
				}

				case 'downlinkBwe':
				{
					logger.debug('\'downlinkBwe\' event:%o', notification.data);

					break;
				}

				case 'consumerPaused':
				{
					const { consumerId } = notification.data;
					const consumer = this._consumers.get(consumerId);

					if (!consumer)
						break;

					consumer.pause();

					store.dispatch(
						stateActions.setConsumerPaused(consumerId, 'remote'));

					break;
				}

				case 'consumerResumed':
				{
					const { consumerId } = notification.data;
					const consumer = this._consumers.get(consumerId);

					if (!consumer)
						break;

					consumer.resume();

					store.dispatch(
						stateActions.setConsumerResumed(consumerId, 'remote'));

					break;
				}

				case 'consumerLayersChanged':
				{
					const { consumerId, spatialLayer, temporalLayer } = notification.data;
					const consumer = this._consumers.get(consumerId);

					if (!consumer)
						break;

					store.dispatch(stateActions.setConsumerCurrentLayers(
						consumerId, spatialLayer, temporalLayer));

					break;
				}

				case 'consumerScore':
				{
					const { consumerId, score } = notification.data;

					store.dispatch(
						stateActions.setConsumerScore(consumerId, score));

					break;
				}

				case 'activeSpeaker':
				{
					const { peerId } = notification.data;

					store.dispatch(
						stateActions.setRoomActiveSpeaker(peerId));

					break;
				}

				default:
				{
					logger.error(
						'unknown protoo notification.method "%s"', notification.method);
				}
			}
		});
	}

	async enableMic()
	{
		if (this._micProducer)
			return;

		const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

		const track = stream.getAudioTracks()[0];

		this._micProducer = await this._sendTransport.produce(
			{
				track,
				codecOptions :
				{
					opusStereo : 1,
					opusDtx    : 1
				}
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
		if (this._webcamProducer)
			return;

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
					sctpParameters,
					iceServers             : [],
					proprietaryConstraints : PC_PROPRIETARY_CONSTRAINTS,
					additionalSettings 	   :
						{ encodedInsertableStreams: this._e2eKey && e2e.isSupported() }
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
						.then(callback)
						.catch(errback);
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
				logger.debug(
					'"producedata" event: [sctpStreamParameters:%o, appData:%o]',
					sctpStreamParameters, appData);

				try
				{
					// eslint-disable-next-line no-shadow
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

		// Create mediasoup Transport for receiving (unless we don't want to consume).
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

		// Join now into the room.
		// NOTE: Don't send our RTP capabilities if we don't want to consume.
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

		store.dispatch(
			stateActions.setRoomState('connected'));

		// Clean all the existing notifcations.
		store.dispatch(
			stateActions.removeAllNotifications());

		store.dispatch(requestActions.notify(
			{
				text    : 'You are in the room!',
				timeout : 3000
			}));

		for (const peer of peers)
		{
			store.dispatch(
				stateActions.addPeer(
					{ ...peer, consumers: [], dataConsumers: [] }));
		}

		// Enable mic/webcam.
		if (this._produce)
		{
			// Set our media capabilities.
			store.dispatch(stateActions.setMediaCapabilities(
				{
					canSendMic    : this._mediasoupDevice.canProduce('audio'),
					canSendWebcam : this._mediasoupDevice.canProduce('video')
				}));

			this.enableMic();

			const devicesCookie = cookiesManager.getDevices();

			if (!devicesCookie || devicesCookie.webcamEnabled || this._externalVideo)
				this.enableWebcam();

			this._sendTransport.on('connectionstatechange', (connectionState) =>
			{
				if (connectionState === 'connected')
				{
					this.enableChatDataProducer();
					this.enableBotDataProducer();
				}
			});
		}

		// NOTE: For testing.
		if (window.SHOW_INFO)
		{
			const { me } = store.getState();

			store.dispatch(
				stateActions.setRoomStatsPeerId(me.id));
		}
	}
}
