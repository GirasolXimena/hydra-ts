export async function Webcam(deviceId: number): Promise<HTMLVideoElement> {
  const devices = await navigator.mediaDevices
    .enumerateDevices();
  const cameras = devices.filter((devices_1) => devices_1.kind === 'videoinput');
  const constraints: MediaStreamConstraints = {
    audio: false,
    video: true,
  };
  if (cameras[deviceId]) {
    constraints['video'] = {
      deviceId: {
        exact: cameras[deviceId].deviceId,
      },
    };
  }
  const stream = await window.navigator.mediaDevices.getUserMedia(constraints);
  const video = document.createElement('video');
  video.setAttribute('autoplay', '');
  video.setAttribute('muted', '');
  video.setAttribute('playsinline', '');
  video.srcObject = stream;
  return await new Promise((resolve, _reject) => {
    video.addEventListener('loadedmetadata', () => {
      video.play().then(() => resolve(video));
    });
  });
}
