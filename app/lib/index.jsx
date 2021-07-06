import domready from 'domready';
import RoomClient from './RoomClient';
import randomString from "random-string";

domready(async () => {
    const roomClient = new RoomClient(
        {
            server: "mediasoup.atome.one",
            port: 443,
            roomId: 0,
            peerId: randomString()
        });

    roomClient.join((audioTrack) => {
            const stream = new MediaStream();

            stream.addTrack(audioTrack);

            const audioElement = document.createElement('audio');
            audioElement.autoplay = true;
            audioElement.playsInline = true;
            audioElement.controls = false;
            document.body.appendChild(audioElement);

            audioElement.srcObject = stream;

            audioElement.play().catch(reason => {
                console.log(('Cannot play audio element. Reason: ' + reason));
            });
        },
        (videoTrack) => {
            const stream = new MediaStream();

            stream.addTrack(videoTrack);

            const videoElement = document.createElement('video');
            videoElement.autoplay = true;
            videoElement.playsInline = true;
            videoElement.muted = true;
            videoElement.controls = false;
            document.body.appendChild(videoElement);

            videoElement.srcObject = stream;

            videoElement.play().catch(reason => {
                console.log(('Cannot play video element. Reason: ' + reason));
            });
        },
        (error) => {
            console.log("Microphone error: " + error);
        },
        (error) => {
            console.log("Camera error: " + error);
        },
        (error) => {
            console.log("Server error: " + error);
        });
});
