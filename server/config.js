/**
 * IMPORTANT (PLEASE READ THIS):
 *
 * This is not the "configuration file" of mediasoup. This is the configuration
 * file of the mediasoup-demo app. mediasoup itself is a server-side library, it
 * does not read any "configuration file". Instead it exposes an API. This demo
 * application just reads settings from this file (once copied to config.js) and
 * calls the mediasoup API with those settings when appropriate.
 */

const os = require('os');

module.exports =
	{
		// Listening hostname (just for `gulp live` task).
		domain : process.env.DOMAIN || 'localhost',
		// Signaling settings (protoo WebSocket server and HTTP API server).
		https  :
			{
				listenIp   : '0.0.0.0',
				listenPort : 4443,
				tls        :
					{
						cert : `${__dirname}/certs/localhost.crt`,
						key  : `${__dirname}/certs/localhost.key`
					}
			},
		// mediasoup settings.
		mediasoup :
			{
				// Number of mediasoup workers to launch.
				numWorkers     : Object.keys(os.cpus()).length,
				// mediasoup WorkerSettings.
				// See https://mediasoup.org/documentation/v3/mediasoup/api/#WorkerSettings
				workerSettings :
					{
						logLevel : 'warn',
						logTags  :
							[
								'info',
								'ice',
								'dtls',
								'rtp',
								'srtp',
								'rtcp',
								'rtx',
								'bwe',
								'score',
								'simulcast',
								'svc',
								'sctp'
							],
						rtcMinPort : 2000,
						rtcMaxPort : 2020
					},
				// mediasoup Router options.
				// See https://mediasoup.org/documentation/v3/mediasoup/api/#RouterOptions
				routerOptions :
					{
						mediaCodecs :
							[
								{
									kind      : 'audio',
									mimeType  : 'audio/opus',
									clockRate : 48000,
									channels  : 2
								},
								{
									kind       : 'video',
									mimeType   : 'video/VP8',
									clockRate  : 90000,
									parameters :
										{
											'x-google-start-bitrate' : 1000
										}
								},
								{
									kind       : 'video',
									mimeType   : 'video/VP9',
									clockRate  : 90000,
									parameters :
										{
											'profile-id'             : 2,
											'x-google-start-bitrate' : 1000
										}
								},
								{
									kind       : 'video',
									mimeType   : 'video/h264',
									clockRate  : 90000,
									parameters :
										{
											'packetization-mode'      : 1,
											'profile-level-id'        : '4d0032',
											'level-asymmetry-allowed' : 1,
											'x-google-start-bitrate'  : 1000
										}
								},
								{
									kind       : 'video',
									mimeType   : 'video/h264',
									clockRate  : 90000,
									parameters :
										{
											'packetization-mode'      : 1,
											'profile-level-id'        : '42e01f',
											'level-asymmetry-allowed' : 1,
											'x-google-start-bitrate'  : 1000
										}
								}
							]
					},
				// mediasoup WebRtcTransport options for WebRTC endpoints (mediasoup-client,
				// libmediasoupclient).
				// See https://mediasoup.org/documentation/v3/mediasoup/api/#WebRtcTransportOptions
				webRtcTransportOptions :
					{
						listenIps :
							[
								{
									ip          : '0.0.0.0',
									announcedIp : '172.18.51.152'
								}
							],
						initialAvailableOutgoingBitrate : 1000000,
						minimumAvailableOutgoingBitrate : 600000,
						maxSctpMessageSize              : 262144,
						// Additional options that are not part of WebRtcTransportOptions.
						maxIncomingBitrate              : 1500000
					},
				// mediasoup PlainTransport options for legacy RTP endpoints (FFmpeg,
				// GStreamer).
				// See https://mediasoup.org/documentation/v3/mediasoup/api/#PlainTransportOptions
				plainTransportOptions :
					{
						listenIp :
							{
								ip          : '0.0.0.0',
								announcedIp : '172.18.51.152'
							},
						maxSctpMessageSize : 262144
					}
			}
	};
