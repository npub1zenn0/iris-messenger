import { memo, useState } from 'react';
import { route } from 'preact-router';
import styled, { css, keyframes } from 'styled-components';

import { Event } from '../../lib/nostr-tools';
import Events from '../../nostr/Events';
import Key from '../../nostr/Key';
import { translate as t } from '../../translations/Translation';
import Modal from '../modal/Modal';
import SafeImg from '../SafeImg';

import EventComponent from './EventComponent';

const fadeIn = keyframes`
  from {
    opacity: 0;
  }

  to {
    opacity: 1;
  }
`;

const GalleryImage = styled.a`
  position: relative;
  aspect-ratio: 1;
  background-size: cover;
  background-position: center;
  background-color: #ccc;
  background-image: url(${(props) =>
    `https://imgproxy.iris.to/insecure/rs:fill:428:428/plain/${props.src}`});
  & .dropdown {
    position: absolute;
    top: 0;
    right: 0;
    z-index: 1;
  }
  & .dropbtn {
    padding-top: 0px;
    margin-top: -5px;
    text-shadow: 0px 0px 5px rgba(0, 0, 0, 0.5);
    color: white;
    user-select: none;
  }
  &:hover {
    opacity: 0.8;
  }

  opacity: ${(props) => (props.fadeIn ? 0 : 1)};
  animation: ${(props) =>
    props.fadeIn
      ? css`
          ${fadeIn} 0.5s ease-in-out forwards
        `
      : 'none'};
`;

function NoteImage(props: { event: Event; fadeIn?: boolean }) {
  const [showImageModal, setShowImageModal] = useState(-1);

  if (props.event.kind !== 1) {
    const id = Events.getEventReplyingTo(props.event);
    return <EventComponent id={id} renderAs="NoteImage" />;
  }
  const attachments = [];
  const urls = props.event.content?.match(/(https?:\/\/[^\s]+)/g);
  if (urls) {
    urls.forEach((url) => {
      let parsedUrl;
      try {
        parsedUrl = new URL(url);
      } catch (e) {
        console.log('invalid url', url);
        return;
      }
      if (parsedUrl.pathname.toLowerCase().match(/\.(jpg|jpeg|gif|png|webp)$/)) {
        attachments.push({ type: 'image', data: parsedUrl.href });
      }
    });
  }
  // return all images from post
  return (
    <>
      {attachments.map((attachment, i) => (
        <>
          <GalleryImage
            key={props.event.id + i}
            onClick={() => setShowImageModal(i)}
            src={attachment.data}
            fadeIn={props.fadeIn}
          />
          {showImageModal === i && (
            <Modal centerVertically={true} onClose={() => setShowImageModal(-1)}>
              <SafeImg src={attachment.data} />
              <p>
                <a
                  href=""
                  onClick={(e) => {
                    e.preventDefault();
                    route('/' + Key.toNostrBech32Address(props.event.id, 'note'));
                  }}
                >
                  {t('show_post')}
                </a>
              </p>
            </Modal>
          )}
        </>
      ))}
    </>
  );
}

export default memo(NoteImage);
