import State from './State.js';
import { translate as t } from './Translation.js';
import Helpers from './Helpers.js';
import Notifications from './Notifications.js';
import PeerManager from './PeerManager.js';
import Session from './Session.js';
import { route } from './lib/preact-router.es.js';

// this file sucks, try to remove it

const chats = window.chats = {};

function getActiveProfile() {
  return window.location.hash.indexOf('#/profile') === 0 ? window.location.hash.replace('#/profile/', '') : null;
}

function newChat(pub, chatLink) {
  if (!pub || Object.prototype.hasOwnProperty.call(chats, pub)) {
    return;
  }
  const chat = new iris.Channel({gun: State.public, key: Session.getKey(), chatLink: chatLink, participants: pub});
  addChat(chat);
}

function followChatLink(str) {
  if (str && str.indexOf('http') === 0) {
    if (str.indexOf('https://iris.to/#/') === 0) {
      route(str.replace('https://iris.to/#', ''));
      return true;
    } else if (str.length > 30) {
      const s = str.split('?');
      let chatId;
      if (s.length === 2) {
        chatId = Helpers.getUrlParameter('chatWith', s[1]) || Helpers.getUrlParameter('channelId', s[1]);
      }
      if (chatId) {
        newChat(chatId, str);
        route('/chat/' + chatId);
        return true;
      }
    }
  }
}

function addChat(chat) {
  var pub = chat.getId();
  if (chats[pub]) { return; }
  chats[pub] = chat;
  const chatNode = State.local.get('chats').get(pub);
  chatNode.get('latestTime').on(t => {
    if (t && (!chat.latestTime || t > chat.latestTime)) {
      chat.latestTime = t;
    } else {
      chatNode.get('latestTime').put(chat.latestTime);
    }
  });
  chatNode.get('theirMsgsLastSeenTime').on(t => {
    if (!t) { return; }
    const d = new Date(t);
    if (!chat.theirMsgsLastSeenDate || chat.theirMsgsLastSeenDate < d) {
      chat.theirMsgsLastSeenDate = d;
    }
  });
  chat.messageIds = chat.messageIds || {};
  chat.getLatestMsg && chat.getLatestMsg((latest, info) => {
    processMessage(pub, latest, info);
  });
  Notifications.changeChatUnseenCount(pub, 0);
  chat.notificationSetting = 'all';
  chat.onMy('notificationSetting', (val) => {
    chat.notificationSetting = val;
    if (pub === getActiveProfile()) {
      $("input[name=notificationPreference][value=" + val + "]").attr('checked', 'checked');
    }
  });
  //$(".chat-list").append(el);
  chat.theirMsgsLastSeenTime = '';
  chat.getTheirMsgsLastSeenTime(time => {
    if (chat && time && time > chat.theirMsgsLastSeenTime) {
      chat.theirMsgsLastSeenTime = time;
      chatNode.get('theirMsgsLastSeenTime').put(time);
    }
  });
  chat.getMyMsgsLastSeenTime(time => {
    chat.myLastSeenTime = new Date(time);
    if (chat.latest && chat.myLastSeenTime >= chat.latest.time) {
      Notifications.changeChatUnseenCount(pub, 0);
    }
    PeerManager.askForPeers(pub); // TODO: this should be done only if we have a chat history or friendship with them
  });
  chat.isTyping = false;
  chat.getTyping(isTyping => {
    chat.isTyping = isTyping;
    State.local.get('chats').get(pub).get('isTyping').put(isTyping);
  });
  chat.online = {};
  iris.Channel.getActivity(State.public, pub, (activity) => {
    if (chat) {
      chatNode.put({theirLastActiveTime: activity && activity.lastActive, activity: activity && activity.isActive && activity.status});
      chat.activity = activity;
    }
  });
  if (chat.uuid) {
    chat.participantProfiles = {};
    chat.onMy('participants', participants => {
      if (typeof participants === 'object') {
        var keys = Object.keys(participants);
        keys.forEach((k, i) => {
          if (chat.participantProfiles[k]) { return; }
          var hue = 360 / Math.max(keys.length, 2) * i; // TODO use css filter brightness
          chat.participantProfiles[k] = {permissions: participants[k], color: `hsl(${hue}, 98%, ${isDarkMode ? 80 : 33}%)`};
          State.public.user(k).get('profile').get('name').on(name => {
            chat.participantProfiles[k].name = name;
          });
        });
      }
      State.local.get('chats').get(chat.uuid).get('participants').put(participants);
    });
    var isDarkMode = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    chat.inviteLinks = {};
    chat.getChatLinks({callback: ({url, id}) => {
      chat.inviteLinks[id] = url;
      if (pub === getActiveProfile()) {
        State.local.get('inviteLinksChanged').put(true);
      }
    }});
  }
  if (chat.put) {
    chat.onTheir('webPushSubscriptions', (s, k, from) => {
      if (!Array.isArray(s)) { return; }
      chat.webPushSubscriptions = chat.webPushSubscriptions || {};
      chat.webPushSubscriptions[from || pub] = s;
    });
    const arr = Object.values(Notifications.webPushSubscriptions);
    setTimeout(() => chat.put('webPushSubscriptions', arr), 5000);
  }
  chat.onTheir('call', call => {
    State.local.get('call').put({pub, call});
  });
  State.local.get('chats').get(pub).put({enabled:true});
}

function processMessage(chatId, msg, info) {
  const chat = chats[chatId];
  if (chat.messageIds[msg.time + info.from]) return;
  chat.messageIds[msg.time + info.from] = true;
  if (info) {
    msg = Object.assign(msg, info);
  }
  msg.selfAuthored = info.selfAuthored;
  msg.timeStr = msg.time;
  State.local.get('chats').get(chatId).get('msgs').get(msg.timeStr).put(msg);
  msg.time = new Date(msg.time);
  if (!info.selfAuthored && msg.time > (chat.myLastSeenTime || -Infinity)) {
    if (window.location.hash !== '#/chat/' + chatId || document.visibilityState !== 'visible') {
      Notifications.changeChatUnseenCount(chatId, 1);
    }
  }
  if (!info.selfAuthored && msg.timeStr > chat.theirMsgsLastSeenTime) {
    State.local.get('chats').get(chatId).get('theirMsgsLastSeenTime').put(msg.timeStr);
  }
  if (!chat.latestTime || (msg.timeStr > chat.latestTime)) {
    State.local.get('chats').get(chatId).put({
      latestTime: msg.timeStr,
      latest: {time: msg.timeStr, text: msg.text, selfAuthored: info.selfAuthored}
    });
  }
  Notifications.notifyMsg(msg, info, chatId);
}

export { chats, addChat, newChat, processMessage, followChatLink };
