import { useState } from 'react';

type Props = {
  src: string;
  class?: string;
  width?: number;
  onError?: () => void;
};

// need to have trailing slash, otherwise you could do https://imgur.com.myevilwebsite.com/image.png
const safeOrigins = [
  'data:image',
  'https://imgur.com/',
  'https://i.imgur.com/',
  'https://imgproxy.irismessengers.wtf/',
];

export const isSafeOrigin = (url: string) => {
  return safeOrigins.some((origin) => url.indexOf(origin) === 0);
};

const SafeImg = (props: Props) => {
  let onError = props.onError;
  let mySrc = props.src;
  let proxyFailed = false;
  if (
    props.src &&
    !props.src.startsWith('data:image') &&
    (!isSafeOrigin(props.src) || props.width)
  ) {
    // free proxy with a 250 images per 10 min limit? https://images.weserv.nl/docs/
    const originalSrc = props.src;
    if (props.width) {
      const width = props.width * 2;
      mySrc = `https://imgproxy.irismessengers.wtf/insecure/rs:fill:${width}:${width}/plain/${originalSrc}`;
    } else {
      mySrc = `https://imgproxy.irismessengers.wtf/insecure/plain/${originalSrc}`;
    }
    const originalOnError = props.onError;
    // try without proxy if it fails
    onError = () => {
      if (proxyFailed) {
        originalOnError && originalOnError();
      } else {
        proxyFailed = true;
        mySrc = originalSrc;
      }
      setSrc(originalSrc);
    };
  }
  const [src, setSrc] = useState(mySrc);

  return <img src={src} onError={onError} className={props.class} width={props.width} />;
};

export default SafeImg;
