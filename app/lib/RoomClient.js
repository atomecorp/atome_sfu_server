import protooClient from 'protoo-client';
import * as mediasoupClient from 'mediasoup-client';
import { getProtooUrl } from './urlFactory';
import * as stateActions from './redux/stateActions';

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
			device
		}
	)
	{
		this._displayName = displayName;
		this._device = device;
		this._protooUrl = getProtooUrl({ roomId, peerId });
		this._protoo = null;
		this._mediasoupDevice = null;
		this._sendTransport = null;
		this._recvTransport = null;
		this._micProducer = null;
		this._webcamProducer = null;
	}

	async join()
	{
		const protooTransport = new protooClient.WebSocketTransport(this._protooUrl);

		this._protoo = new protooClient.Peer(protooTransport);

		this._protoo.on('open', () => this._joinRoom());

		this._protoo.on('request', async (request, accept) =>
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
				id     : this._micProducer.id,
				paused : this._micProducer.paused,
				track  : this._micProducer.track
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
				id    : this._webcamProducer.id,
				track : this._webcamProducer.track
			}));
	}

	async _joinRoom()
	{
		this._mediasoupDevice = new mediasoupClient.Device();

		const routerRtpCapabilities = await this._protoo.request('getRouterRtpCapabilities');

		await this._mediasoupDevice.load({ routerRtpCapabilities });

		const producerTransportInfo = await this._protoo.request(
			'createWebRtcTransport',
			{
				producing : true
			});

		this._sendTransport = this._mediasoupDevice.createSendTransport(producerTransportInfo);

		this._sendTransport.on(
			'connect', ({ dtlsParameters }, callback) =>
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
			'produce', async ({ kind, rtpParameters, appData }, callback) =>
			{
				const { id } = await this._protoo.request(
					'produce',
					{
						transportId : this._sendTransport.id,
						kind,
						rtpParameters,
						appData
					});

				callback({ id });
			});

		this._sendTransport.on('producedata', async (
			{
				sctpStreamParameters,
				label,
				protocol,
				appData
			},
			callback
		) =>
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
		});

		const consumerTransportInfo = await this._protoo.request(
			'createWebRtcTransport',
			{
				consuming : true
			});

		this._recvTransport = this._mediasoupDevice.createRecvTransport(consumerTransportInfo);

		this._recvTransport.on(
			'connect', ({ dtlsParameters }, callback) =>
			{
				this._protoo.request(
					'connectWebRtcTransport',
					{
						transportId : this._recvTransport.id,
						dtlsParameters
					})
					.then(callback);
			});

		const { peers } = await this._protoo.request(
			'join',
			{
				displayName     : this._displayName,
				device          : this._device,
				rtpCapabilities : this._mediasoupDevice.rtpCapabilities
			});

		for (const peer of peers)
		{
			store.dispatch(
				stateActions.addPeer(
					{ ...peer, consumers: [], dataConsumers: [] }));
		}

		this.enableMic();
		this.enableWebcam();
	}
}
