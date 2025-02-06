// @bun
var __create = Object.create;
var __getProtoOf = Object.getPrototypeOf;
var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __toESM = (mod, isNodeMode, target) => {
  target = mod != null ? __create(__getProtoOf(mod)) : {};
  const to = isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target;
  for (let key of __getOwnPropNames(mod))
    if (!__hasOwnProp.call(to, key))
      __defProp(to, key, {
        get: () => mod[key],
        enumerable: true
      });
  return to;
};
var __moduleCache = /* @__PURE__ */ new WeakMap;
var __toCommonJS = (from) => {
  var entry = __moduleCache.get(from), desc;
  if (entry)
    return entry;
  entry = __defProp({}, "__esModule", { value: true });
  if (from && typeof from === "object" || typeof from === "function")
    __getOwnPropNames(from).map((key) => !__hasOwnProp.call(entry, key) && __defProp(entry, key, {
      get: () => from[key],
      enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
    }));
  __moduleCache.set(from, entry);
  return entry;
};
var __commonJS = (cb, mod) => () => (mod || cb((mod = { exports: {} }).exports, mod), mod.exports);
var __require = import.meta.require;

// node_modules/grammy/out/filter.js
var require_filter = __commonJS((exports) => {
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.matchFilter = matchFilter;
  exports.parse = parse;
  exports.preprocess = preprocess;
  var filterQueryCache = new Map;
  function matchFilter(filter) {
    var _a;
    const queries = Array.isArray(filter) ? filter : [filter];
    const key = queries.join(",");
    const predicate = (_a = filterQueryCache.get(key)) !== null && _a !== undefined ? _a : (() => {
      const parsed = parse(queries);
      const pred = compile(parsed);
      filterQueryCache.set(key, pred);
      return pred;
    })();
    return (ctx) => predicate(ctx);
  }
  function parse(filter) {
    return Array.isArray(filter) ? filter.map((q) => q.split(":")) : [filter.split(":")];
  }
  function compile(parsed) {
    const preprocessed = parsed.flatMap((q) => check(q, preprocess(q)));
    const ltree = treeify(preprocessed);
    const predicate = arborist(ltree);
    return (ctx) => !!predicate(ctx.update, ctx);
  }
  function preprocess(filter) {
    const valid = UPDATE_KEYS;
    const expanded = [filter].flatMap((q) => {
      const [l1, l2, l3] = q;
      if (!(l1 in L1_SHORTCUTS))
        return [q];
      if (!l1 && !l2 && !l3)
        return [q];
      const targets = L1_SHORTCUTS[l1];
      const expanded2 = targets.map((s) => [s, l2, l3]);
      if (l2 === undefined)
        return expanded2;
      if (l2 in L2_SHORTCUTS && (l2 || l3))
        return expanded2;
      return expanded2.filter(([s]) => {
        var _a;
        return !!((_a = valid[s]) === null || _a === undefined ? undefined : _a[l2]);
      });
    }).flatMap((q) => {
      const [l1, l2, l3] = q;
      if (!(l2 in L2_SHORTCUTS))
        return [q];
      if (!l2 && !l3)
        return [q];
      const targets = L2_SHORTCUTS[l2];
      const expanded2 = targets.map((s) => [l1, s, l3]);
      if (l3 === undefined)
        return expanded2;
      return expanded2.filter(([, s]) => {
        var _a, _b;
        return !!((_b = (_a = valid[l1]) === null || _a === undefined ? undefined : _a[s]) === null || _b === undefined ? undefined : _b[l3]);
      });
    });
    if (expanded.length === 0) {
      throw new Error(`Shortcuts in '${filter.join(":")}' do not expand to any valid filter query`);
    }
    return expanded;
  }
  function check(original, preprocessed) {
    if (preprocessed.length === 0)
      throw new Error("Empty filter query given");
    const errors = preprocessed.map(checkOne).filter((r) => r !== true);
    if (errors.length === 0)
      return preprocessed;
    else if (errors.length === 1)
      throw new Error(errors[0]);
    else {
      throw new Error(`Invalid filter query '${original.join(":")}'. There are ${errors.length} errors after expanding the contained shortcuts: ${errors.join("; ")}`);
    }
  }
  function checkOne(filter) {
    const [l1, l2, l3, ...n] = filter;
    if (l1 === undefined)
      return "Empty filter query given";
    if (!(l1 in UPDATE_KEYS)) {
      const permitted = Object.keys(UPDATE_KEYS);
      return `Invalid L1 filter '${l1}' given in '${filter.join(":")}'. Permitted values are: ${permitted.map((k) => `'${k}'`).join(", ")}.`;
    }
    if (l2 === undefined)
      return true;
    const l1Obj = UPDATE_KEYS[l1];
    if (!(l2 in l1Obj)) {
      const permitted = Object.keys(l1Obj);
      return `Invalid L2 filter '${l2}' given in '${filter.join(":")}'. Permitted values are: ${permitted.map((k) => `'${k}'`).join(", ")}.`;
    }
    if (l3 === undefined)
      return true;
    const l2Obj = l1Obj[l2];
    if (!(l3 in l2Obj)) {
      const permitted = Object.keys(l2Obj);
      return `Invalid L3 filter '${l3}' given in '${filter.join(":")}'. ${permitted.length === 0 ? `No further filtering is possible after '${l1}:${l2}'.` : `Permitted values are: ${permitted.map((k) => `'${k}'`).join(", ")}.`}`;
    }
    if (n.length === 0)
      return true;
    return `Cannot filter further than three levels, ':${n.join(":")}' is invalid!`;
  }
  function treeify(paths) {
    var _a, _b;
    const tree = {};
    for (const [l1, l2, l3] of paths) {
      const subtree = (_a = tree[l1]) !== null && _a !== undefined ? _a : tree[l1] = {};
      if (l2 !== undefined) {
        const set = (_b = subtree[l2]) !== null && _b !== undefined ? _b : subtree[l2] = new Set;
        if (l3 !== undefined)
          set.add(l3);
      }
    }
    return tree;
  }
  function or(left, right) {
    return (obj, ctx) => left(obj, ctx) || right(obj, ctx);
  }
  function concat(get, test) {
    return (obj, ctx) => {
      const nextObj = get(obj, ctx);
      return nextObj && test(nextObj, ctx);
    };
  }
  function leaf(pred) {
    return (obj, ctx) => pred(obj, ctx) != null;
  }
  function arborist(tree) {
    const l1Predicates = Object.entries(tree).map(([l1, subtree]) => {
      const l1Pred = (obj) => obj[l1];
      const l2Predicates = Object.entries(subtree).map(([l2, set]) => {
        const l2Pred = (obj) => obj[l2];
        const l3Predicates = Array.from(set).map((l3) => {
          const l3Pred = l3 === "me" ? (obj, ctx) => {
            const me = ctx.me.id;
            return testMaybeArray(obj, (u) => u.id === me);
          } : (obj) => testMaybeArray(obj, (e) => e[l3] || e.type === l3);
          return l3Pred;
        });
        return l3Predicates.length === 0 ? leaf(l2Pred) : concat(l2Pred, l3Predicates.reduce(or));
      });
      return l2Predicates.length === 0 ? leaf(l1Pred) : concat(l1Pred, l2Predicates.reduce(or));
    });
    if (l1Predicates.length === 0) {
      throw new Error("Cannot create filter function for empty query");
    }
    return l1Predicates.reduce(or);
  }
  function testMaybeArray(t, pred) {
    const p = (x) => x != null && pred(x);
    return Array.isArray(t) ? t.some(p) : p(t);
  }
  var ENTITY_KEYS = {
    mention: {},
    hashtag: {},
    cashtag: {},
    bot_command: {},
    url: {},
    email: {},
    phone_number: {},
    bold: {},
    italic: {},
    underline: {},
    strikethrough: {},
    spoiler: {},
    blockquote: {},
    expandable_blockquote: {},
    code: {},
    pre: {},
    text_link: {},
    text_mention: {},
    custom_emoji: {}
  };
  var USER_KEYS = {
    me: {},
    is_bot: {},
    is_premium: {},
    added_to_attachment_menu: {}
  };
  var FORWARD_ORIGIN_KEYS = {
    user: {},
    hidden_user: {},
    chat: {},
    channel: {}
  };
  var STICKER_KEYS = {
    is_video: {},
    is_animated: {},
    premium_animation: {}
  };
  var REACTION_KEYS = {
    emoji: {},
    custom_emoji: {},
    paid: {}
  };
  var COMMON_MESSAGE_KEYS = {
    forward_origin: FORWARD_ORIGIN_KEYS,
    is_topic_message: {},
    is_automatic_forward: {},
    business_connection_id: {},
    text: {},
    animation: {},
    audio: {},
    document: {},
    paid_media: {},
    photo: {},
    sticker: STICKER_KEYS,
    story: {},
    video: {},
    video_note: {},
    voice: {},
    contact: {},
    dice: {},
    game: {},
    poll: {},
    venue: {},
    location: {},
    entities: ENTITY_KEYS,
    caption_entities: ENTITY_KEYS,
    caption: {},
    effect_id: {},
    has_media_spoiler: {},
    new_chat_title: {},
    new_chat_photo: {},
    delete_chat_photo: {},
    message_auto_delete_timer_changed: {},
    pinned_message: {},
    invoice: {},
    proximity_alert_triggered: {},
    chat_background_set: {},
    giveaway_created: {},
    giveaway: { only_new_members: {}, has_public_winners: {} },
    giveaway_winners: { only_new_members: {}, was_refunded: {} },
    giveaway_completed: {},
    video_chat_scheduled: {},
    video_chat_started: {},
    video_chat_ended: {},
    video_chat_participants_invited: {},
    web_app_data: {}
  };
  var MESSAGE_KEYS = {
    ...COMMON_MESSAGE_KEYS,
    new_chat_members: USER_KEYS,
    left_chat_member: USER_KEYS,
    group_chat_created: {},
    supergroup_chat_created: {},
    migrate_to_chat_id: {},
    migrate_from_chat_id: {},
    successful_payment: {},
    refunded_payment: {},
    users_shared: {},
    chat_shared: {},
    connected_website: {},
    write_access_allowed: {},
    passport_data: {},
    boost_added: {},
    forum_topic_created: {},
    forum_topic_edited: { name: {}, icon_custom_emoji_id: {} },
    forum_topic_closed: {},
    forum_topic_reopened: {},
    general_forum_topic_hidden: {},
    general_forum_topic_unhidden: {},
    sender_boost_count: {}
  };
  var CHANNEL_POST_KEYS = {
    ...COMMON_MESSAGE_KEYS,
    channel_chat_created: {}
  };
  var BUSINESS_CONNECTION_KEYS = {
    can_reply: {},
    is_enabled: {}
  };
  var MESSAGE_REACTION_KEYS = {
    old_reaction: REACTION_KEYS,
    new_reaction: REACTION_KEYS
  };
  var MESSAGE_REACTION_COUNT_UPDATED_KEYS = {
    reactions: REACTION_KEYS
  };
  var CALLBACK_QUERY_KEYS = { data: {}, game_short_name: {} };
  var CHAT_MEMBER_UPDATED_KEYS = { from: USER_KEYS };
  var UPDATE_KEYS = {
    message: MESSAGE_KEYS,
    edited_message: MESSAGE_KEYS,
    channel_post: CHANNEL_POST_KEYS,
    edited_channel_post: CHANNEL_POST_KEYS,
    business_connection: BUSINESS_CONNECTION_KEYS,
    business_message: MESSAGE_KEYS,
    edited_business_message: MESSAGE_KEYS,
    deleted_business_messages: {},
    inline_query: {},
    chosen_inline_result: {},
    callback_query: CALLBACK_QUERY_KEYS,
    shipping_query: {},
    pre_checkout_query: {},
    poll: {},
    poll_answer: {},
    my_chat_member: CHAT_MEMBER_UPDATED_KEYS,
    chat_member: CHAT_MEMBER_UPDATED_KEYS,
    chat_join_request: {},
    message_reaction: MESSAGE_REACTION_KEYS,
    message_reaction_count: MESSAGE_REACTION_COUNT_UPDATED_KEYS,
    chat_boost: {},
    removed_chat_boost: {},
    purchased_paid_media: {}
  };
  var L1_SHORTCUTS = {
    "": ["message", "channel_post"],
    msg: ["message", "channel_post"],
    edit: ["edited_message", "edited_channel_post"]
  };
  var L2_SHORTCUTS = {
    "": ["entities", "caption_entities"],
    media: ["photo", "video"],
    file: [
      "photo",
      "animation",
      "audio",
      "document",
      "video",
      "video_note",
      "voice",
      "sticker"
    ]
  };
});

// node_modules/grammy/out/context.js
var require_context = __commonJS((exports) => {
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.Context = undefined;
  var filter_js_1 = require_filter();
  var checker = {
    filterQuery(filter) {
      const pred = (0, filter_js_1.matchFilter)(filter);
      return (ctx) => pred(ctx);
    },
    text(trigger) {
      const hasText = checker.filterQuery([":text", ":caption"]);
      const trg = triggerFn(trigger);
      return (ctx) => {
        var _a, _b;
        if (!hasText(ctx))
          return false;
        const msg = (_a = ctx.message) !== null && _a !== undefined ? _a : ctx.channelPost;
        const txt = (_b = msg.text) !== null && _b !== undefined ? _b : msg.caption;
        return match(ctx, txt, trg);
      };
    },
    command(command) {
      const hasEntities = checker.filterQuery(":entities:bot_command");
      const atCommands = new Set;
      const noAtCommands = new Set;
      toArray(command).forEach((cmd) => {
        if (cmd.startsWith("/")) {
          throw new Error(`Do not include '/' when registering command handlers (use '${cmd.substring(1)}' not '${cmd}')`);
        }
        const set = cmd.includes("@") ? atCommands : noAtCommands;
        set.add(cmd);
      });
      return (ctx) => {
        var _a, _b;
        if (!hasEntities(ctx))
          return false;
        const msg = (_a = ctx.message) !== null && _a !== undefined ? _a : ctx.channelPost;
        const txt = (_b = msg.text) !== null && _b !== undefined ? _b : msg.caption;
        return msg.entities.some((e) => {
          if (e.type !== "bot_command")
            return false;
          if (e.offset !== 0)
            return false;
          const cmd = txt.substring(1, e.length);
          if (noAtCommands.has(cmd) || atCommands.has(cmd)) {
            ctx.match = txt.substring(cmd.length + 1).trimStart();
            return true;
          }
          const index = cmd.indexOf("@");
          if (index === -1)
            return false;
          const atTarget = cmd.substring(index + 1).toLowerCase();
          const username = ctx.me.username.toLowerCase();
          if (atTarget !== username)
            return false;
          const atCommand = cmd.substring(0, index);
          if (noAtCommands.has(atCommand)) {
            ctx.match = txt.substring(cmd.length + 1).trimStart();
            return true;
          }
          return false;
        });
      };
    },
    reaction(reaction) {
      const hasMessageReaction = checker.filterQuery("message_reaction");
      const normalized = typeof reaction === "string" ? [{ type: "emoji", emoji: reaction }] : (Array.isArray(reaction) ? reaction : [reaction]).map((emoji2) => typeof emoji2 === "string" ? { type: "emoji", emoji: emoji2 } : emoji2);
      const emoji = new Set(normalized.filter((r) => r.type === "emoji").map((r) => r.emoji));
      const customEmoji = new Set(normalized.filter((r) => r.type === "custom_emoji").map((r) => r.custom_emoji_id));
      const paid = normalized.some((r) => r.type === "paid");
      return (ctx) => {
        if (!hasMessageReaction(ctx))
          return false;
        const { old_reaction, new_reaction } = ctx.messageReaction;
        for (const reaction2 of new_reaction) {
          let isOld = false;
          if (reaction2.type === "emoji") {
            for (const old of old_reaction) {
              if (old.type !== "emoji")
                continue;
              if (old.emoji === reaction2.emoji) {
                isOld = true;
                break;
              }
            }
          } else if (reaction2.type === "custom_emoji") {
            for (const old of old_reaction) {
              if (old.type !== "custom_emoji")
                continue;
              if (old.custom_emoji_id === reaction2.custom_emoji_id) {
                isOld = true;
                break;
              }
            }
          } else if (reaction2.type === "paid") {
            for (const old of old_reaction) {
              if (old.type !== "paid")
                continue;
              isOld = true;
              break;
            }
          } else {
          }
          if (isOld)
            continue;
          if (reaction2.type === "emoji") {
            if (emoji.has(reaction2.emoji))
              return true;
          } else if (reaction2.type === "custom_emoji") {
            if (customEmoji.has(reaction2.custom_emoji_id))
              return true;
          } else if (reaction2.type === "paid") {
            if (paid)
              return true;
          } else {
            return true;
          }
        }
        return false;
      };
    },
    chatType(chatType) {
      const set = new Set(toArray(chatType));
      return (ctx) => {
        var _a;
        return ((_a = ctx.chat) === null || _a === undefined ? undefined : _a.type) !== undefined && set.has(ctx.chat.type);
      };
    },
    callbackQuery(trigger) {
      const hasCallbackQuery = checker.filterQuery("callback_query:data");
      const trg = triggerFn(trigger);
      return (ctx) => hasCallbackQuery(ctx) && match(ctx, ctx.callbackQuery.data, trg);
    },
    gameQuery(trigger) {
      const hasGameQuery = checker.filterQuery("callback_query:game_short_name");
      const trg = triggerFn(trigger);
      return (ctx) => hasGameQuery(ctx) && match(ctx, ctx.callbackQuery.game_short_name, trg);
    },
    inlineQuery(trigger) {
      const hasInlineQuery = checker.filterQuery("inline_query");
      const trg = triggerFn(trigger);
      return (ctx) => hasInlineQuery(ctx) && match(ctx, ctx.inlineQuery.query, trg);
    },
    chosenInlineResult(trigger) {
      const hasChosenInlineResult = checker.filterQuery("chosen_inline_result");
      const trg = triggerFn(trigger);
      return (ctx) => hasChosenInlineResult(ctx) && match(ctx, ctx.chosenInlineResult.result_id, trg);
    },
    preCheckoutQuery(trigger) {
      const hasPreCheckoutQuery = checker.filterQuery("pre_checkout_query");
      const trg = triggerFn(trigger);
      return (ctx) => hasPreCheckoutQuery(ctx) && match(ctx, ctx.preCheckoutQuery.invoice_payload, trg);
    },
    shippingQuery(trigger) {
      const hasShippingQuery = checker.filterQuery("shipping_query");
      const trg = triggerFn(trigger);
      return (ctx) => hasShippingQuery(ctx) && match(ctx, ctx.shippingQuery.invoice_payload, trg);
    }
  };

  class Context {
    constructor(update, api, me) {
      this.update = update;
      this.api = api;
      this.me = me;
    }
    get message() {
      return this.update.message;
    }
    get editedMessage() {
      return this.update.edited_message;
    }
    get channelPost() {
      return this.update.channel_post;
    }
    get editedChannelPost() {
      return this.update.edited_channel_post;
    }
    get businessConnection() {
      return this.update.business_connection;
    }
    get businessMessage() {
      return this.update.business_message;
    }
    get editedBusinessMessage() {
      return this.update.edited_business_message;
    }
    get deletedBusinessMessages() {
      return this.update.deleted_business_messages;
    }
    get messageReaction() {
      return this.update.message_reaction;
    }
    get messageReactionCount() {
      return this.update.message_reaction_count;
    }
    get inlineQuery() {
      return this.update.inline_query;
    }
    get chosenInlineResult() {
      return this.update.chosen_inline_result;
    }
    get callbackQuery() {
      return this.update.callback_query;
    }
    get shippingQuery() {
      return this.update.shipping_query;
    }
    get preCheckoutQuery() {
      return this.update.pre_checkout_query;
    }
    get poll() {
      return this.update.poll;
    }
    get pollAnswer() {
      return this.update.poll_answer;
    }
    get myChatMember() {
      return this.update.my_chat_member;
    }
    get chatMember() {
      return this.update.chat_member;
    }
    get chatJoinRequest() {
      return this.update.chat_join_request;
    }
    get chatBoost() {
      return this.update.chat_boost;
    }
    get removedChatBoost() {
      return this.update.removed_chat_boost;
    }
    get purchasedPaidMedia() {
      return this.update.purchased_paid_media;
    }
    get msg() {
      var _a, _b, _c, _d, _e, _f, _g;
      return (_f = (_e = (_d = (_c = (_b = (_a = this.message) !== null && _a !== undefined ? _a : this.editedMessage) !== null && _b !== undefined ? _b : this.channelPost) !== null && _c !== undefined ? _c : this.editedChannelPost) !== null && _d !== undefined ? _d : this.businessMessage) !== null && _e !== undefined ? _e : this.editedBusinessMessage) !== null && _f !== undefined ? _f : (_g = this.callbackQuery) === null || _g === undefined ? undefined : _g.message;
    }
    get chat() {
      var _a, _b, _c, _d, _e, _f, _g, _h, _j;
      return (_j = (_h = (_g = (_f = (_e = (_d = (_c = (_b = (_a = this.msg) !== null && _a !== undefined ? _a : this.deletedBusinessMessages) !== null && _b !== undefined ? _b : this.messageReaction) !== null && _c !== undefined ? _c : this.messageReactionCount) !== null && _d !== undefined ? _d : this.myChatMember) !== null && _e !== undefined ? _e : this.chatMember) !== null && _f !== undefined ? _f : this.chatJoinRequest) !== null && _g !== undefined ? _g : this.chatBoost) !== null && _h !== undefined ? _h : this.removedChatBoost) === null || _j === undefined ? undefined : _j.chat;
    }
    get senderChat() {
      var _a;
      return (_a = this.msg) === null || _a === undefined ? undefined : _a.sender_chat;
    }
    get from() {
      var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s;
      return (_g = (_f = (_b = (_a = this.businessConnection) !== null && _a !== undefined ? _a : this.messageReaction) !== null && _b !== undefined ? _b : (_e = (_d = (_c = this.chatBoost) === null || _c === undefined ? undefined : _c.boost) !== null && _d !== undefined ? _d : this.removedChatBoost) === null || _e === undefined ? undefined : _e.source) === null || _f === undefined ? undefined : _f.user) !== null && _g !== undefined ? _g : (_s = (_r = (_q = (_p = (_o = (_m = (_l = (_k = (_j = (_h = this.callbackQuery) !== null && _h !== undefined ? _h : this.msg) !== null && _j !== undefined ? _j : this.inlineQuery) !== null && _k !== undefined ? _k : this.chosenInlineResult) !== null && _l !== undefined ? _l : this.shippingQuery) !== null && _m !== undefined ? _m : this.preCheckoutQuery) !== null && _o !== undefined ? _o : this.myChatMember) !== null && _p !== undefined ? _p : this.chatMember) !== null && _q !== undefined ? _q : this.chatJoinRequest) !== null && _r !== undefined ? _r : this.purchasedPaidMedia) === null || _s === undefined ? undefined : _s.from;
    }
    get msgId() {
      var _a, _b, _c, _d, _e;
      return (_d = (_b = (_a = this.msg) === null || _a === undefined ? undefined : _a.message_id) !== null && _b !== undefined ? _b : (_c = this.messageReaction) === null || _c === undefined ? undefined : _c.message_id) !== null && _d !== undefined ? _d : (_e = this.messageReactionCount) === null || _e === undefined ? undefined : _e.message_id;
    }
    get chatId() {
      var _a, _b, _c;
      return (_b = (_a = this.chat) === null || _a === undefined ? undefined : _a.id) !== null && _b !== undefined ? _b : (_c = this.businessConnection) === null || _c === undefined ? undefined : _c.user_chat_id;
    }
    get inlineMessageId() {
      var _a, _b, _c;
      return (_b = (_a = this.callbackQuery) === null || _a === undefined ? undefined : _a.inline_message_id) !== null && _b !== undefined ? _b : (_c = this.chosenInlineResult) === null || _c === undefined ? undefined : _c.inline_message_id;
    }
    get businessConnectionId() {
      var _a, _b, _c, _d, _e;
      return (_d = (_b = (_a = this.msg) === null || _a === undefined ? undefined : _a.business_connection_id) !== null && _b !== undefined ? _b : (_c = this.businessConnection) === null || _c === undefined ? undefined : _c.id) !== null && _d !== undefined ? _d : (_e = this.deletedBusinessMessages) === null || _e === undefined ? undefined : _e.business_connection_id;
    }
    entities(types) {
      var _a, _b;
      const message = this.msg;
      if (message === undefined)
        return [];
      const text = (_a = message.text) !== null && _a !== undefined ? _a : message.caption;
      if (text === undefined)
        return [];
      let entities = (_b = message.entities) !== null && _b !== undefined ? _b : message.caption_entities;
      if (entities === undefined)
        return [];
      if (types !== undefined) {
        const filters = new Set(toArray(types));
        entities = entities.filter((entity) => filters.has(entity.type));
      }
      return entities.map((entity) => ({
        ...entity,
        text: text.substring(entity.offset, entity.offset + entity.length)
      }));
    }
    reactions() {
      const emoji = [];
      const emojiAdded = [];
      const emojiKept = [];
      const emojiRemoved = [];
      const customEmoji = [];
      const customEmojiAdded = [];
      const customEmojiKept = [];
      const customEmojiRemoved = [];
      let paid = false;
      let paidAdded = false;
      const r = this.messageReaction;
      if (r !== undefined) {
        const { old_reaction, new_reaction } = r;
        for (const reaction of new_reaction) {
          if (reaction.type === "emoji") {
            emoji.push(reaction.emoji);
          } else if (reaction.type === "custom_emoji") {
            customEmoji.push(reaction.custom_emoji_id);
          } else if (reaction.type === "paid") {
            paid = paidAdded = true;
          }
        }
        for (const reaction of old_reaction) {
          if (reaction.type === "emoji") {
            emojiRemoved.push(reaction.emoji);
          } else if (reaction.type === "custom_emoji") {
            customEmojiRemoved.push(reaction.custom_emoji_id);
          } else if (reaction.type === "paid") {
            paidAdded = false;
          }
        }
        emojiAdded.push(...emoji);
        customEmojiAdded.push(...customEmoji);
        for (let i = 0;i < emojiRemoved.length; i++) {
          const len = emojiAdded.length;
          if (len === 0)
            break;
          const rem = emojiRemoved[i];
          for (let j = 0;j < len; j++) {
            if (rem === emojiAdded[j]) {
              emojiKept.push(rem);
              emojiRemoved.splice(i, 1);
              emojiAdded.splice(j, 1);
              i--;
              break;
            }
          }
        }
        for (let i = 0;i < customEmojiRemoved.length; i++) {
          const len = customEmojiAdded.length;
          if (len === 0)
            break;
          const rem = customEmojiRemoved[i];
          for (let j = 0;j < len; j++) {
            if (rem === customEmojiAdded[j]) {
              customEmojiKept.push(rem);
              customEmojiRemoved.splice(i, 1);
              customEmojiAdded.splice(j, 1);
              i--;
              break;
            }
          }
        }
      }
      return {
        emoji,
        emojiAdded,
        emojiKept,
        emojiRemoved,
        customEmoji,
        customEmojiAdded,
        customEmojiKept,
        customEmojiRemoved,
        paid,
        paidAdded
      };
    }
    has(filter) {
      return Context.has.filterQuery(filter)(this);
    }
    hasText(trigger) {
      return Context.has.text(trigger)(this);
    }
    hasCommand(command) {
      return Context.has.command(command)(this);
    }
    hasReaction(reaction) {
      return Context.has.reaction(reaction)(this);
    }
    hasChatType(chatType) {
      return Context.has.chatType(chatType)(this);
    }
    hasCallbackQuery(trigger) {
      return Context.has.callbackQuery(trigger)(this);
    }
    hasGameQuery(trigger) {
      return Context.has.gameQuery(trigger)(this);
    }
    hasInlineQuery(trigger) {
      return Context.has.inlineQuery(trigger)(this);
    }
    hasChosenInlineResult(trigger) {
      return Context.has.chosenInlineResult(trigger)(this);
    }
    hasPreCheckoutQuery(trigger) {
      return Context.has.preCheckoutQuery(trigger)(this);
    }
    hasShippingQuery(trigger) {
      return Context.has.shippingQuery(trigger)(this);
    }
    reply(text, other, signal) {
      return this.api.sendMessage(orThrow(this.chatId, "sendMessage"), text, { business_connection_id: this.businessConnectionId, ...other }, signal);
    }
    forwardMessage(chat_id, other, signal) {
      return this.api.forwardMessage(chat_id, orThrow(this.chatId, "forwardMessage"), orThrow(this.msgId, "forwardMessage"), other, signal);
    }
    forwardMessages(chat_id, message_ids, other, signal) {
      return this.api.forwardMessages(chat_id, orThrow(this.chatId, "forwardMessages"), message_ids, other, signal);
    }
    copyMessage(chat_id, other, signal) {
      return this.api.copyMessage(chat_id, orThrow(this.chatId, "copyMessage"), orThrow(this.msgId, "copyMessage"), other, signal);
    }
    copyMessages(chat_id, message_ids, other, signal) {
      return this.api.copyMessages(chat_id, orThrow(this.chatId, "copyMessages"), message_ids, other, signal);
    }
    replyWithPhoto(photo, other, signal) {
      return this.api.sendPhoto(orThrow(this.chatId, "sendPhoto"), photo, { business_connection_id: this.businessConnectionId, ...other }, signal);
    }
    replyWithAudio(audio, other, signal) {
      return this.api.sendAudio(orThrow(this.chatId, "sendAudio"), audio, { business_connection_id: this.businessConnectionId, ...other }, signal);
    }
    replyWithDocument(document2, other, signal) {
      return this.api.sendDocument(orThrow(this.chatId, "sendDocument"), document2, { business_connection_id: this.businessConnectionId, ...other }, signal);
    }
    replyWithVideo(video, other, signal) {
      return this.api.sendVideo(orThrow(this.chatId, "sendVideo"), video, { business_connection_id: this.businessConnectionId, ...other }, signal);
    }
    replyWithAnimation(animation, other, signal) {
      return this.api.sendAnimation(orThrow(this.chatId, "sendAnimation"), animation, { business_connection_id: this.businessConnectionId, ...other }, signal);
    }
    replyWithVoice(voice, other, signal) {
      return this.api.sendVoice(orThrow(this.chatId, "sendVoice"), voice, { business_connection_id: this.businessConnectionId, ...other }, signal);
    }
    replyWithVideoNote(video_note, other, signal) {
      return this.api.sendVideoNote(orThrow(this.chatId, "sendVideoNote"), video_note, { business_connection_id: this.businessConnectionId, ...other }, signal);
    }
    replyWithMediaGroup(media, other, signal) {
      return this.api.sendMediaGroup(orThrow(this.chatId, "sendMediaGroup"), media, { business_connection_id: this.businessConnectionId, ...other }, signal);
    }
    replyWithLocation(latitude, longitude, other, signal) {
      return this.api.sendLocation(orThrow(this.chatId, "sendLocation"), latitude, longitude, { business_connection_id: this.businessConnectionId, ...other }, signal);
    }
    editMessageLiveLocation(latitude, longitude, other, signal) {
      const inlineId = this.inlineMessageId;
      return inlineId !== undefined ? this.api.editMessageLiveLocationInline(inlineId, latitude, longitude, other) : this.api.editMessageLiveLocation(orThrow(this.chatId, "editMessageLiveLocation"), orThrow(this.msgId, "editMessageLiveLocation"), latitude, longitude, other, signal);
    }
    stopMessageLiveLocation(other, signal) {
      const inlineId = this.inlineMessageId;
      return inlineId !== undefined ? this.api.stopMessageLiveLocationInline(inlineId, other) : this.api.stopMessageLiveLocation(orThrow(this.chatId, "stopMessageLiveLocation"), orThrow(this.msgId, "stopMessageLiveLocation"), other, signal);
    }
    sendPaidMedia(star_count, media, other, signal) {
      return this.api.sendPaidMedia(orThrow(this.chatId, "sendPaidMedia"), star_count, media, other, signal);
    }
    replyWithVenue(latitude, longitude, title, address, other, signal) {
      return this.api.sendVenue(orThrow(this.chatId, "sendVenue"), latitude, longitude, title, address, { business_connection_id: this.businessConnectionId, ...other }, signal);
    }
    replyWithContact(phone_number, first_name, other, signal) {
      return this.api.sendContact(orThrow(this.chatId, "sendContact"), phone_number, first_name, { business_connection_id: this.businessConnectionId, ...other }, signal);
    }
    replyWithPoll(question, options, other, signal) {
      return this.api.sendPoll(orThrow(this.chatId, "sendPoll"), question, options, { business_connection_id: this.businessConnectionId, ...other }, signal);
    }
    replyWithDice(emoji, other, signal) {
      return this.api.sendDice(orThrow(this.chatId, "sendDice"), emoji, { business_connection_id: this.businessConnectionId, ...other }, signal);
    }
    replyWithChatAction(action, other, signal) {
      return this.api.sendChatAction(orThrow(this.chatId, "sendChatAction"), action, { business_connection_id: this.businessConnectionId, ...other }, signal);
    }
    react(reaction, other, signal) {
      return this.api.setMessageReaction(orThrow(this.chatId, "setMessageReaction"), orThrow(this.msgId, "setMessageReaction"), typeof reaction === "string" ? [{ type: "emoji", emoji: reaction }] : (Array.isArray(reaction) ? reaction : [reaction]).map((emoji) => typeof emoji === "string" ? { type: "emoji", emoji } : emoji), other, signal);
    }
    getUserProfilePhotos(other, signal) {
      return this.api.getUserProfilePhotos(orThrow(this.from, "getUserProfilePhotos").id, other, signal);
    }
    setUserEmojiStatus(other, signal) {
      return this.api.setUserEmojiStatus(orThrow(this.from, "setUserEmojiStatus").id, other, signal);
    }
    getUserChatBoosts(chat_id, signal) {
      return this.api.getUserChatBoosts(chat_id, orThrow(this.from, "getUserChatBoosts").id, signal);
    }
    getBusinessConnection(signal) {
      return this.api.getBusinessConnection(orThrow(this.businessConnectionId, "getBusinessConnection"), signal);
    }
    getFile(signal) {
      var _a, _b, _c, _d, _e, _f;
      const m = orThrow(this.msg, "getFile");
      const file = m.photo !== undefined ? m.photo[m.photo.length - 1] : (_f = (_e = (_d = (_c = (_b = (_a = m.animation) !== null && _a !== undefined ? _a : m.audio) !== null && _b !== undefined ? _b : m.document) !== null && _c !== undefined ? _c : m.video) !== null && _d !== undefined ? _d : m.video_note) !== null && _e !== undefined ? _e : m.voice) !== null && _f !== undefined ? _f : m.sticker;
      return this.api.getFile(orThrow(file, "getFile").file_id, signal);
    }
    kickAuthor(...args) {
      return this.banAuthor(...args);
    }
    banAuthor(other, signal) {
      return this.api.banChatMember(orThrow(this.chatId, "banAuthor"), orThrow(this.from, "banAuthor").id, other, signal);
    }
    kickChatMember(...args) {
      return this.banChatMember(...args);
    }
    banChatMember(user_id, other, signal) {
      return this.api.banChatMember(orThrow(this.chatId, "banChatMember"), user_id, other, signal);
    }
    unbanChatMember(user_id, other, signal) {
      return this.api.unbanChatMember(orThrow(this.chatId, "unbanChatMember"), user_id, other, signal);
    }
    restrictAuthor(permissions, other, signal) {
      return this.api.restrictChatMember(orThrow(this.chatId, "restrictAuthor"), orThrow(this.from, "restrictAuthor").id, permissions, other, signal);
    }
    restrictChatMember(user_id, permissions, other, signal) {
      return this.api.restrictChatMember(orThrow(this.chatId, "restrictChatMember"), user_id, permissions, other, signal);
    }
    promoteAuthor(other, signal) {
      return this.api.promoteChatMember(orThrow(this.chatId, "promoteAuthor"), orThrow(this.from, "promoteAuthor").id, other, signal);
    }
    promoteChatMember(user_id, other, signal) {
      return this.api.promoteChatMember(orThrow(this.chatId, "promoteChatMember"), user_id, other, signal);
    }
    setChatAdministratorAuthorCustomTitle(custom_title, signal) {
      return this.api.setChatAdministratorCustomTitle(orThrow(this.chatId, "setChatAdministratorAuthorCustomTitle"), orThrow(this.from, "setChatAdministratorAuthorCustomTitle").id, custom_title, signal);
    }
    setChatAdministratorCustomTitle(user_id, custom_title, signal) {
      return this.api.setChatAdministratorCustomTitle(orThrow(this.chatId, "setChatAdministratorCustomTitle"), user_id, custom_title, signal);
    }
    banChatSenderChat(sender_chat_id, signal) {
      return this.api.banChatSenderChat(orThrow(this.chatId, "banChatSenderChat"), sender_chat_id, signal);
    }
    unbanChatSenderChat(sender_chat_id, signal) {
      return this.api.unbanChatSenderChat(orThrow(this.chatId, "unbanChatSenderChat"), sender_chat_id, signal);
    }
    setChatPermissions(permissions, other, signal) {
      return this.api.setChatPermissions(orThrow(this.chatId, "setChatPermissions"), permissions, other, signal);
    }
    exportChatInviteLink(signal) {
      return this.api.exportChatInviteLink(orThrow(this.chatId, "exportChatInviteLink"), signal);
    }
    createChatInviteLink(other, signal) {
      return this.api.createChatInviteLink(orThrow(this.chatId, "createChatInviteLink"), other, signal);
    }
    editChatInviteLink(invite_link, other, signal) {
      return this.api.editChatInviteLink(orThrow(this.chatId, "editChatInviteLink"), invite_link, other, signal);
    }
    createChatSubscriptionInviteLink(subscription_period, subscription_price, other, signal) {
      return this.api.createChatSubscriptionInviteLink(orThrow(this.chatId, "createChatSubscriptionInviteLink"), subscription_period, subscription_price, other, signal);
    }
    editChatSubscriptionInviteLink(invite_link, other, signal) {
      return this.api.editChatSubscriptionInviteLink(orThrow(this.chatId, "editChatSubscriptionInviteLink"), invite_link, other, signal);
    }
    revokeChatInviteLink(invite_link, signal) {
      return this.api.revokeChatInviteLink(orThrow(this.chatId, "editChatInviteLink"), invite_link, signal);
    }
    approveChatJoinRequest(user_id, signal) {
      return this.api.approveChatJoinRequest(orThrow(this.chatId, "approveChatJoinRequest"), user_id, signal);
    }
    declineChatJoinRequest(user_id, signal) {
      return this.api.declineChatJoinRequest(orThrow(this.chatId, "declineChatJoinRequest"), user_id, signal);
    }
    setChatPhoto(photo, signal) {
      return this.api.setChatPhoto(orThrow(this.chatId, "setChatPhoto"), photo, signal);
    }
    deleteChatPhoto(signal) {
      return this.api.deleteChatPhoto(orThrow(this.chatId, "deleteChatPhoto"), signal);
    }
    setChatTitle(title, signal) {
      return this.api.setChatTitle(orThrow(this.chatId, "setChatTitle"), title, signal);
    }
    setChatDescription(description, signal) {
      return this.api.setChatDescription(orThrow(this.chatId, "setChatDescription"), description, signal);
    }
    pinChatMessage(message_id, other, signal) {
      return this.api.pinChatMessage(orThrow(this.chatId, "pinChatMessage"), message_id, other, signal);
    }
    unpinChatMessage(message_id, signal) {
      return this.api.unpinChatMessage(orThrow(this.chatId, "unpinChatMessage"), message_id, signal);
    }
    unpinAllChatMessages(signal) {
      return this.api.unpinAllChatMessages(orThrow(this.chatId, "unpinAllChatMessages"), signal);
    }
    leaveChat(signal) {
      return this.api.leaveChat(orThrow(this.chatId, "leaveChat"), signal);
    }
    getChat(signal) {
      return this.api.getChat(orThrow(this.chatId, "getChat"), signal);
    }
    getChatAdministrators(signal) {
      return this.api.getChatAdministrators(orThrow(this.chatId, "getChatAdministrators"), signal);
    }
    getChatMembersCount(...args) {
      return this.getChatMemberCount(...args);
    }
    getChatMemberCount(signal) {
      return this.api.getChatMemberCount(orThrow(this.chatId, "getChatMemberCount"), signal);
    }
    getAuthor(signal) {
      return this.api.getChatMember(orThrow(this.chatId, "getAuthor"), orThrow(this.from, "getAuthor").id, signal);
    }
    getChatMember(user_id, signal) {
      return this.api.getChatMember(orThrow(this.chatId, "getChatMember"), user_id, signal);
    }
    setChatStickerSet(sticker_set_name, signal) {
      return this.api.setChatStickerSet(orThrow(this.chatId, "setChatStickerSet"), sticker_set_name, signal);
    }
    deleteChatStickerSet(signal) {
      return this.api.deleteChatStickerSet(orThrow(this.chatId, "deleteChatStickerSet"), signal);
    }
    createForumTopic(name, other, signal) {
      return this.api.createForumTopic(orThrow(this.chatId, "createForumTopic"), name, other, signal);
    }
    editForumTopic(other, signal) {
      const message = orThrow(this.msg, "editForumTopic");
      const thread = orThrow(message.message_thread_id, "editForumTopic");
      return this.api.editForumTopic(message.chat.id, thread, other, signal);
    }
    closeForumTopic(signal) {
      const message = orThrow(this.msg, "closeForumTopic");
      const thread = orThrow(message.message_thread_id, "closeForumTopic");
      return this.api.closeForumTopic(message.chat.id, thread, signal);
    }
    reopenForumTopic(signal) {
      const message = orThrow(this.msg, "reopenForumTopic");
      const thread = orThrow(message.message_thread_id, "reopenForumTopic");
      return this.api.reopenForumTopic(message.chat.id, thread, signal);
    }
    deleteForumTopic(signal) {
      const message = orThrow(this.msg, "deleteForumTopic");
      const thread = orThrow(message.message_thread_id, "deleteForumTopic");
      return this.api.deleteForumTopic(message.chat.id, thread, signal);
    }
    unpinAllForumTopicMessages(signal) {
      const message = orThrow(this.msg, "unpinAllForumTopicMessages");
      const thread = orThrow(message.message_thread_id, "unpinAllForumTopicMessages");
      return this.api.unpinAllForumTopicMessages(message.chat.id, thread, signal);
    }
    editGeneralForumTopic(name, signal) {
      return this.api.editGeneralForumTopic(orThrow(this.chatId, "editGeneralForumTopic"), name, signal);
    }
    closeGeneralForumTopic(signal) {
      return this.api.closeGeneralForumTopic(orThrow(this.chatId, "closeGeneralForumTopic"), signal);
    }
    reopenGeneralForumTopic(signal) {
      return this.api.reopenGeneralForumTopic(orThrow(this.chatId, "reopenGeneralForumTopic"), signal);
    }
    hideGeneralForumTopic(signal) {
      return this.api.hideGeneralForumTopic(orThrow(this.chatId, "hideGeneralForumTopic"), signal);
    }
    unhideGeneralForumTopic(signal) {
      return this.api.unhideGeneralForumTopic(orThrow(this.chatId, "unhideGeneralForumTopic"), signal);
    }
    unpinAllGeneralForumTopicMessages(signal) {
      return this.api.unpinAllGeneralForumTopicMessages(orThrow(this.chatId, "unpinAllGeneralForumTopicMessages"), signal);
    }
    answerCallbackQuery(other, signal) {
      return this.api.answerCallbackQuery(orThrow(this.callbackQuery, "answerCallbackQuery").id, typeof other === "string" ? { text: other } : other, signal);
    }
    setChatMenuButton(other, signal) {
      return this.api.setChatMenuButton(other, signal);
    }
    getChatMenuButton(other, signal) {
      return this.api.getChatMenuButton(other, signal);
    }
    setMyDefaultAdministratorRights(other, signal) {
      return this.api.setMyDefaultAdministratorRights(other, signal);
    }
    getMyDefaultAdministratorRights(other, signal) {
      return this.api.getMyDefaultAdministratorRights(other, signal);
    }
    editMessageText(text, other, signal) {
      var _a, _b, _c, _d, _e;
      const inlineId = this.inlineMessageId;
      return inlineId !== undefined ? this.api.editMessageTextInline(inlineId, text, other) : this.api.editMessageText(orThrow(this.chatId, "editMessageText"), orThrow((_d = (_b = (_a = this.msg) === null || _a === undefined ? undefined : _a.message_id) !== null && _b !== undefined ? _b : (_c = this.messageReaction) === null || _c === undefined ? undefined : _c.message_id) !== null && _d !== undefined ? _d : (_e = this.messageReactionCount) === null || _e === undefined ? undefined : _e.message_id, "editMessageText"), text, other, signal);
    }
    editMessageCaption(other, signal) {
      var _a, _b, _c, _d, _e;
      const inlineId = this.inlineMessageId;
      return inlineId !== undefined ? this.api.editMessageCaptionInline(inlineId, other) : this.api.editMessageCaption(orThrow(this.chatId, "editMessageCaption"), orThrow((_d = (_b = (_a = this.msg) === null || _a === undefined ? undefined : _a.message_id) !== null && _b !== undefined ? _b : (_c = this.messageReaction) === null || _c === undefined ? undefined : _c.message_id) !== null && _d !== undefined ? _d : (_e = this.messageReactionCount) === null || _e === undefined ? undefined : _e.message_id, "editMessageCaption"), other, signal);
    }
    editMessageMedia(media, other, signal) {
      var _a, _b, _c, _d, _e;
      const inlineId = this.inlineMessageId;
      return inlineId !== undefined ? this.api.editMessageMediaInline(inlineId, media, other) : this.api.editMessageMedia(orThrow(this.chatId, "editMessageMedia"), orThrow((_d = (_b = (_a = this.msg) === null || _a === undefined ? undefined : _a.message_id) !== null && _b !== undefined ? _b : (_c = this.messageReaction) === null || _c === undefined ? undefined : _c.message_id) !== null && _d !== undefined ? _d : (_e = this.messageReactionCount) === null || _e === undefined ? undefined : _e.message_id, "editMessageMedia"), media, other, signal);
    }
    editMessageReplyMarkup(other, signal) {
      var _a, _b, _c, _d, _e;
      const inlineId = this.inlineMessageId;
      return inlineId !== undefined ? this.api.editMessageReplyMarkupInline(inlineId, other) : this.api.editMessageReplyMarkup(orThrow(this.chatId, "editMessageReplyMarkup"), orThrow((_d = (_b = (_a = this.msg) === null || _a === undefined ? undefined : _a.message_id) !== null && _b !== undefined ? _b : (_c = this.messageReaction) === null || _c === undefined ? undefined : _c.message_id) !== null && _d !== undefined ? _d : (_e = this.messageReactionCount) === null || _e === undefined ? undefined : _e.message_id, "editMessageReplyMarkup"), other, signal);
    }
    stopPoll(other, signal) {
      var _a, _b, _c, _d, _e;
      return this.api.stopPoll(orThrow(this.chatId, "stopPoll"), orThrow((_d = (_b = (_a = this.msg) === null || _a === undefined ? undefined : _a.message_id) !== null && _b !== undefined ? _b : (_c = this.messageReaction) === null || _c === undefined ? undefined : _c.message_id) !== null && _d !== undefined ? _d : (_e = this.messageReactionCount) === null || _e === undefined ? undefined : _e.message_id, "stopPoll"), other, signal);
    }
    deleteMessage(signal) {
      var _a, _b, _c, _d, _e;
      return this.api.deleteMessage(orThrow(this.chatId, "deleteMessage"), orThrow((_d = (_b = (_a = this.msg) === null || _a === undefined ? undefined : _a.message_id) !== null && _b !== undefined ? _b : (_c = this.messageReaction) === null || _c === undefined ? undefined : _c.message_id) !== null && _d !== undefined ? _d : (_e = this.messageReactionCount) === null || _e === undefined ? undefined : _e.message_id, "deleteMessage"), signal);
    }
    deleteMessages(message_ids, signal) {
      return this.api.deleteMessages(orThrow(this.chatId, "deleteMessages"), message_ids, signal);
    }
    replyWithSticker(sticker, other, signal) {
      return this.api.sendSticker(orThrow(this.chatId, "sendSticker"), sticker, { business_connection_id: this.businessConnectionId, ...other }, signal);
    }
    getCustomEmojiStickers(signal) {
      var _a, _b;
      return this.api.getCustomEmojiStickers(((_b = (_a = this.msg) === null || _a === undefined ? undefined : _a.entities) !== null && _b !== undefined ? _b : []).filter((e) => e.type === "custom_emoji").map((e) => e.custom_emoji_id), signal);
    }
    replyWithGift(gift_id, other, signal) {
      return this.api.sendGift(orThrow(this.from, "sendGift").id, gift_id, other, signal);
    }
    answerInlineQuery(results, other, signal) {
      return this.api.answerInlineQuery(orThrow(this.inlineQuery, "answerInlineQuery").id, results, other, signal);
    }
    savePreparedInlineMessage(result, other, signal) {
      return this.api.savePreparedInlineMessage(orThrow(this.from, "savePreparedInlineMessage").id, result, other, signal);
    }
    replyWithInvoice(title, description, payload, currency, prices, other, signal) {
      return this.api.sendInvoice(orThrow(this.chatId, "sendInvoice"), title, description, payload, currency, prices, other, signal);
    }
    answerShippingQuery(ok, other, signal) {
      return this.api.answerShippingQuery(orThrow(this.shippingQuery, "answerShippingQuery").id, ok, other, signal);
    }
    answerPreCheckoutQuery(ok, other, signal) {
      return this.api.answerPreCheckoutQuery(orThrow(this.preCheckoutQuery, "answerPreCheckoutQuery").id, ok, typeof other === "string" ? { error_message: other } : other, signal);
    }
    refundStarPayment(signal) {
      var _a;
      return this.api.refundStarPayment(orThrow(this.from, "refundStarPayment").id, orThrow((_a = this.msg) === null || _a === undefined ? undefined : _a.successful_payment, "refundStarPayment").telegram_payment_charge_id, signal);
    }
    editUserStarSubscription(telegram_payment_charge_id, is_canceled, signal) {
      return this.api.editUserStarSubscription(orThrow(this.from, "editUserStarSubscription").id, telegram_payment_charge_id, is_canceled, signal);
    }
    verifyUser(other, signal) {
      return this.api.verifyUser(orThrow(this.from, "verifyUser").id, other, signal);
    }
    verifyChat(other, signal) {
      return this.api.verifyChat(orThrow(this.chatId, "verifyChat"), other, signal);
    }
    removeUserVerification(signal) {
      return this.api.removeUserVerification(orThrow(this.from, "removeUserVerification").id, signal);
    }
    removeChatVerification(signal) {
      return this.api.removeChatVerification(orThrow(this.chatId, "removeChatVerification"), signal);
    }
    setPassportDataErrors(errors, signal) {
      return this.api.setPassportDataErrors(orThrow(this.from, "setPassportDataErrors").id, errors, signal);
    }
    replyWithGame(game_short_name, other, signal) {
      return this.api.sendGame(orThrow(this.chatId, "sendGame"), game_short_name, { business_connection_id: this.businessConnectionId, ...other }, signal);
    }
  }
  exports.Context = Context;
  Context.has = checker;
  function orThrow(value, method) {
    if (value === undefined) {
      throw new Error(`Missing information for API call to ${method}`);
    }
    return value;
  }
  function triggerFn(trigger) {
    return toArray(trigger).map((t) => typeof t === "string" ? (txt) => txt === t ? t : null : (txt) => txt.match(t));
  }
  function match(ctx, content, triggers) {
    for (const t of triggers) {
      const res = t(content);
      if (res) {
        ctx.match = res;
        return true;
      }
    }
    return false;
  }
  function toArray(e) {
    return Array.isArray(e) ? e : [e];
  }
});

// node_modules/grammy/out/composer.js
var require_composer = __commonJS((exports) => {
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.Composer = exports.BotError = undefined;
  exports.run = run;
  var context_js_1 = require_context();

  class BotError extends Error {
    constructor(error, ctx) {
      super(generateBotErrorMessage(error));
      this.error = error;
      this.ctx = ctx;
      this.name = "BotError";
      if (error instanceof Error)
        this.stack = error.stack;
    }
  }
  exports.BotError = BotError;
  function generateBotErrorMessage(error) {
    let msg;
    if (error instanceof Error) {
      msg = `${error.name} in middleware: ${error.message}`;
    } else {
      const type = typeof error;
      msg = `Non-error value of type ${type} thrown in middleware`;
      switch (type) {
        case "bigint":
        case "boolean":
        case "number":
        case "symbol":
          msg += `: ${error}`;
          break;
        case "string":
          msg += `: ${String(error).substring(0, 50)}`;
          break;
        default:
          msg += "!";
          break;
      }
    }
    return msg;
  }
  function flatten(mw) {
    return typeof mw === "function" ? mw : (ctx, next) => mw.middleware()(ctx, next);
  }
  function concat(first, andThen) {
    return async (ctx, next) => {
      let nextCalled = false;
      await first(ctx, async () => {
        if (nextCalled)
          throw new Error("`next` already called before!");
        else
          nextCalled = true;
        await andThen(ctx, next);
      });
    };
  }
  function pass(_ctx, next) {
    return next();
  }
  var leaf = () => Promise.resolve();
  async function run(middleware, ctx) {
    await middleware(ctx, leaf);
  }

  class Composer {
    constructor(...middleware) {
      this.handler = middleware.length === 0 ? pass : middleware.map(flatten).reduce(concat);
    }
    middleware() {
      return this.handler;
    }
    use(...middleware) {
      const composer = new Composer(...middleware);
      this.handler = concat(this.handler, flatten(composer));
      return composer;
    }
    on(filter, ...middleware) {
      return this.filter(context_js_1.Context.has.filterQuery(filter), ...middleware);
    }
    hears(trigger, ...middleware) {
      return this.filter(context_js_1.Context.has.text(trigger), ...middleware);
    }
    command(command, ...middleware) {
      return this.filter(context_js_1.Context.has.command(command), ...middleware);
    }
    reaction(reaction, ...middleware) {
      return this.filter(context_js_1.Context.has.reaction(reaction), ...middleware);
    }
    chatType(chatType, ...middleware) {
      return this.filter(context_js_1.Context.has.chatType(chatType), ...middleware);
    }
    callbackQuery(trigger, ...middleware) {
      return this.filter(context_js_1.Context.has.callbackQuery(trigger), ...middleware);
    }
    gameQuery(trigger, ...middleware) {
      return this.filter(context_js_1.Context.has.gameQuery(trigger), ...middleware);
    }
    inlineQuery(trigger, ...middleware) {
      return this.filter(context_js_1.Context.has.inlineQuery(trigger), ...middleware);
    }
    chosenInlineResult(resultId, ...middleware) {
      return this.filter(context_js_1.Context.has.chosenInlineResult(resultId), ...middleware);
    }
    preCheckoutQuery(trigger, ...middleware) {
      return this.filter(context_js_1.Context.has.preCheckoutQuery(trigger), ...middleware);
    }
    shippingQuery(trigger, ...middleware) {
      return this.filter(context_js_1.Context.has.shippingQuery(trigger), ...middleware);
    }
    filter(predicate, ...middleware) {
      const composer = new Composer(...middleware);
      this.branch(predicate, composer, pass);
      return composer;
    }
    drop(predicate, ...middleware) {
      return this.filter(async (ctx) => !await predicate(ctx), ...middleware);
    }
    fork(...middleware) {
      const composer = new Composer(...middleware);
      const fork = flatten(composer);
      this.use((ctx, next) => Promise.all([next(), run(fork, ctx)]));
      return composer;
    }
    lazy(middlewareFactory) {
      return this.use(async (ctx, next) => {
        const middleware = await middlewareFactory(ctx);
        const arr = Array.isArray(middleware) ? middleware : [middleware];
        await flatten(new Composer(...arr))(ctx, next);
      });
    }
    route(router, routeHandlers, fallback = pass) {
      return this.lazy(async (ctx) => {
        var _a;
        const route = await router(ctx);
        return (_a = route === undefined || !routeHandlers[route] ? fallback : routeHandlers[route]) !== null && _a !== undefined ? _a : [];
      });
    }
    branch(predicate, trueMiddleware, falseMiddleware) {
      return this.lazy(async (ctx) => await predicate(ctx) ? trueMiddleware : falseMiddleware);
    }
    errorBoundary(errorHandler, ...middleware) {
      const composer = new Composer(...middleware);
      const bound = flatten(composer);
      this.use(async (ctx, next) => {
        let nextCalled = false;
        const cont = () => (nextCalled = true, Promise.resolve());
        try {
          await bound(ctx, cont);
        } catch (err) {
          nextCalled = false;
          await errorHandler(new BotError(err, ctx), cont);
        }
        if (nextCalled)
          await next();
      });
      return composer;
    }
  }
  exports.Composer = Composer;
});

// node_modules/ms/index.js
var require_ms = __commonJS((exports, module) => {
  var s = 1000;
  var m = s * 60;
  var h = m * 60;
  var d = h * 24;
  var w = d * 7;
  var y = d * 365.25;
  module.exports = function(val, options) {
    options = options || {};
    var type = typeof val;
    if (type === "string" && val.length > 0) {
      return parse(val);
    } else if (type === "number" && isFinite(val)) {
      return options.long ? fmtLong(val) : fmtShort(val);
    }
    throw new Error("val is not a non-empty string or a valid number. val=" + JSON.stringify(val));
  };
  function parse(str) {
    str = String(str);
    if (str.length > 100) {
      return;
    }
    var match = /^(-?(?:\d+)?\.?\d+) *(milliseconds?|msecs?|ms|seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h|days?|d|weeks?|w|years?|yrs?|y)?$/i.exec(str);
    if (!match) {
      return;
    }
    var n = parseFloat(match[1]);
    var type = (match[2] || "ms").toLowerCase();
    switch (type) {
      case "years":
      case "year":
      case "yrs":
      case "yr":
      case "y":
        return n * y;
      case "weeks":
      case "week":
      case "w":
        return n * w;
      case "days":
      case "day":
      case "d":
        return n * d;
      case "hours":
      case "hour":
      case "hrs":
      case "hr":
      case "h":
        return n * h;
      case "minutes":
      case "minute":
      case "mins":
      case "min":
      case "m":
        return n * m;
      case "seconds":
      case "second":
      case "secs":
      case "sec":
      case "s":
        return n * s;
      case "milliseconds":
      case "millisecond":
      case "msecs":
      case "msec":
      case "ms":
        return n;
      default:
        return;
    }
  }
  function fmtShort(ms) {
    var msAbs = Math.abs(ms);
    if (msAbs >= d) {
      return Math.round(ms / d) + "d";
    }
    if (msAbs >= h) {
      return Math.round(ms / h) + "h";
    }
    if (msAbs >= m) {
      return Math.round(ms / m) + "m";
    }
    if (msAbs >= s) {
      return Math.round(ms / s) + "s";
    }
    return ms + "ms";
  }
  function fmtLong(ms) {
    var msAbs = Math.abs(ms);
    if (msAbs >= d) {
      return plural(ms, msAbs, d, "day");
    }
    if (msAbs >= h) {
      return plural(ms, msAbs, h, "hour");
    }
    if (msAbs >= m) {
      return plural(ms, msAbs, m, "minute");
    }
    if (msAbs >= s) {
      return plural(ms, msAbs, s, "second");
    }
    return ms + " ms";
  }
  function plural(ms, msAbs, n, name) {
    var isPlural = msAbs >= n * 1.5;
    return Math.round(ms / n) + " " + name + (isPlural ? "s" : "");
  }
});

// node_modules/debug/src/common.js
var require_common = __commonJS((exports, module) => {
  function setup(env) {
    createDebug.debug = createDebug;
    createDebug.default = createDebug;
    createDebug.coerce = coerce;
    createDebug.disable = disable;
    createDebug.enable = enable;
    createDebug.enabled = enabled;
    createDebug.humanize = require_ms();
    createDebug.destroy = destroy;
    Object.keys(env).forEach((key) => {
      createDebug[key] = env[key];
    });
    createDebug.names = [];
    createDebug.skips = [];
    createDebug.formatters = {};
    function selectColor(namespace) {
      let hash = 0;
      for (let i = 0;i < namespace.length; i++) {
        hash = (hash << 5) - hash + namespace.charCodeAt(i);
        hash |= 0;
      }
      return createDebug.colors[Math.abs(hash) % createDebug.colors.length];
    }
    createDebug.selectColor = selectColor;
    function createDebug(namespace) {
      let prevTime;
      let enableOverride = null;
      let namespacesCache;
      let enabledCache;
      function debug(...args) {
        if (!debug.enabled) {
          return;
        }
        const self = debug;
        const curr = Number(new Date);
        const ms = curr - (prevTime || curr);
        self.diff = ms;
        self.prev = prevTime;
        self.curr = curr;
        prevTime = curr;
        args[0] = createDebug.coerce(args[0]);
        if (typeof args[0] !== "string") {
          args.unshift("%O");
        }
        let index = 0;
        args[0] = args[0].replace(/%([a-zA-Z%])/g, (match, format) => {
          if (match === "%%") {
            return "%";
          }
          index++;
          const formatter = createDebug.formatters[format];
          if (typeof formatter === "function") {
            const val = args[index];
            match = formatter.call(self, val);
            args.splice(index, 1);
            index--;
          }
          return match;
        });
        createDebug.formatArgs.call(self, args);
        const logFn = self.log || createDebug.log;
        logFn.apply(self, args);
      }
      debug.namespace = namespace;
      debug.useColors = createDebug.useColors();
      debug.color = createDebug.selectColor(namespace);
      debug.extend = extend;
      debug.destroy = createDebug.destroy;
      Object.defineProperty(debug, "enabled", {
        enumerable: true,
        configurable: false,
        get: () => {
          if (enableOverride !== null) {
            return enableOverride;
          }
          if (namespacesCache !== createDebug.namespaces) {
            namespacesCache = createDebug.namespaces;
            enabledCache = createDebug.enabled(namespace);
          }
          return enabledCache;
        },
        set: (v) => {
          enableOverride = v;
        }
      });
      if (typeof createDebug.init === "function") {
        createDebug.init(debug);
      }
      return debug;
    }
    function extend(namespace, delimiter) {
      const newDebug = createDebug(this.namespace + (typeof delimiter === "undefined" ? ":" : delimiter) + namespace);
      newDebug.log = this.log;
      return newDebug;
    }
    function enable(namespaces) {
      createDebug.save(namespaces);
      createDebug.namespaces = namespaces;
      createDebug.names = [];
      createDebug.skips = [];
      const split = (typeof namespaces === "string" ? namespaces : "").trim().replace(" ", ",").split(",").filter(Boolean);
      for (const ns of split) {
        if (ns[0] === "-") {
          createDebug.skips.push(ns.slice(1));
        } else {
          createDebug.names.push(ns);
        }
      }
    }
    function matchesTemplate(search, template) {
      let searchIndex = 0;
      let templateIndex = 0;
      let starIndex = -1;
      let matchIndex = 0;
      while (searchIndex < search.length) {
        if (templateIndex < template.length && (template[templateIndex] === search[searchIndex] || template[templateIndex] === "*")) {
          if (template[templateIndex] === "*") {
            starIndex = templateIndex;
            matchIndex = searchIndex;
            templateIndex++;
          } else {
            searchIndex++;
            templateIndex++;
          }
        } else if (starIndex !== -1) {
          templateIndex = starIndex + 1;
          matchIndex++;
          searchIndex = matchIndex;
        } else {
          return false;
        }
      }
      while (templateIndex < template.length && template[templateIndex] === "*") {
        templateIndex++;
      }
      return templateIndex === template.length;
    }
    function disable() {
      const namespaces = [
        ...createDebug.names,
        ...createDebug.skips.map((namespace) => "-" + namespace)
      ].join(",");
      createDebug.enable("");
      return namespaces;
    }
    function enabled(name) {
      for (const skip of createDebug.skips) {
        if (matchesTemplate(name, skip)) {
          return false;
        }
      }
      for (const ns of createDebug.names) {
        if (matchesTemplate(name, ns)) {
          return true;
        }
      }
      return false;
    }
    function coerce(val) {
      if (val instanceof Error) {
        return val.stack || val.message;
      }
      return val;
    }
    function destroy() {
      console.warn("Instance method `debug.destroy()` is deprecated and no longer does anything. It will be removed in the next major version of `debug`.");
    }
    createDebug.enable(createDebug.load());
    return createDebug;
  }
  module.exports = setup;
});

// node_modules/debug/src/browser.js
var require_browser = __commonJS((exports, module) => {
  exports.formatArgs = formatArgs;
  exports.save = save;
  exports.load = load;
  exports.useColors = useColors;
  exports.storage = localstorage();
  exports.destroy = (() => {
    let warned = false;
    return () => {
      if (!warned) {
        warned = true;
        console.warn("Instance method `debug.destroy()` is deprecated and no longer does anything. It will be removed in the next major version of `debug`.");
      }
    };
  })();
  exports.colors = [
    "#0000CC",
    "#0000FF",
    "#0033CC",
    "#0033FF",
    "#0066CC",
    "#0066FF",
    "#0099CC",
    "#0099FF",
    "#00CC00",
    "#00CC33",
    "#00CC66",
    "#00CC99",
    "#00CCCC",
    "#00CCFF",
    "#3300CC",
    "#3300FF",
    "#3333CC",
    "#3333FF",
    "#3366CC",
    "#3366FF",
    "#3399CC",
    "#3399FF",
    "#33CC00",
    "#33CC33",
    "#33CC66",
    "#33CC99",
    "#33CCCC",
    "#33CCFF",
    "#6600CC",
    "#6600FF",
    "#6633CC",
    "#6633FF",
    "#66CC00",
    "#66CC33",
    "#9900CC",
    "#9900FF",
    "#9933CC",
    "#9933FF",
    "#99CC00",
    "#99CC33",
    "#CC0000",
    "#CC0033",
    "#CC0066",
    "#CC0099",
    "#CC00CC",
    "#CC00FF",
    "#CC3300",
    "#CC3333",
    "#CC3366",
    "#CC3399",
    "#CC33CC",
    "#CC33FF",
    "#CC6600",
    "#CC6633",
    "#CC9900",
    "#CC9933",
    "#CCCC00",
    "#CCCC33",
    "#FF0000",
    "#FF0033",
    "#FF0066",
    "#FF0099",
    "#FF00CC",
    "#FF00FF",
    "#FF3300",
    "#FF3333",
    "#FF3366",
    "#FF3399",
    "#FF33CC",
    "#FF33FF",
    "#FF6600",
    "#FF6633",
    "#FF9900",
    "#FF9933",
    "#FFCC00",
    "#FFCC33"
  ];
  function useColors() {
    if (typeof window !== "undefined" && window.process && (window.process.type === "renderer" || window.process.__nwjs)) {
      return true;
    }
    if (typeof navigator !== "undefined" && navigator.userAgent && navigator.userAgent.toLowerCase().match(/(edge|trident)\/(\d+)/)) {
      return false;
    }
    let m;
    return typeof document !== "undefined" && document.documentElement && document.documentElement.style && document.documentElement.style.WebkitAppearance || typeof window !== "undefined" && window.console && (window.console.firebug || window.console.exception && window.console.table) || typeof navigator !== "undefined" && navigator.userAgent && (m = navigator.userAgent.toLowerCase().match(/firefox\/(\d+)/)) && parseInt(m[1], 10) >= 31 || typeof navigator !== "undefined" && navigator.userAgent && navigator.userAgent.toLowerCase().match(/applewebkit\/(\d+)/);
  }
  function formatArgs(args) {
    args[0] = (this.useColors ? "%c" : "") + this.namespace + (this.useColors ? " %c" : " ") + args[0] + (this.useColors ? "%c " : " ") + "+" + module.exports.humanize(this.diff);
    if (!this.useColors) {
      return;
    }
    const c = "color: " + this.color;
    args.splice(1, 0, c, "color: inherit");
    let index = 0;
    let lastC = 0;
    args[0].replace(/%[a-zA-Z%]/g, (match) => {
      if (match === "%%") {
        return;
      }
      index++;
      if (match === "%c") {
        lastC = index;
      }
    });
    args.splice(lastC, 0, c);
  }
  exports.log = console.debug || console.log || (() => {
  });
  function save(namespaces) {
    try {
      if (namespaces) {
        exports.storage.setItem("debug", namespaces);
      } else {
        exports.storage.removeItem("debug");
      }
    } catch (error) {
    }
  }
  function load() {
    let r;
    try {
      r = exports.storage.getItem("debug");
    } catch (error) {
    }
    if (!r && typeof process !== "undefined" && "env" in process) {
      r = process.env.DEBUG;
    }
    return r;
  }
  function localstorage() {
    try {
      return localStorage;
    } catch (error) {
    }
  }
  module.exports = require_common()(exports);
  var { formatters } = module.exports;
  formatters.j = function(v) {
    try {
      return JSON.stringify(v);
    } catch (error) {
      return "[UnexpectedJSONParseError]: " + error.message;
    }
  };
});

// node_modules/debug/src/node.js
var require_node = __commonJS((exports, module) => {
  var tty = __require("tty");
  var util = __require("util");
  exports.init = init;
  exports.log = log;
  exports.formatArgs = formatArgs;
  exports.save = save;
  exports.load = load;
  exports.useColors = useColors;
  exports.destroy = util.deprecate(() => {
  }, "Instance method `debug.destroy()` is deprecated and no longer does anything. It will be removed in the next major version of `debug`.");
  exports.colors = [6, 2, 3, 4, 5, 1];
  try {
    const supportsColor = (()=>{throw new Error("Cannot require module "+"supports-color");})();
    if (supportsColor && (supportsColor.stderr || supportsColor).level >= 2) {
      exports.colors = [
        20,
        21,
        26,
        27,
        32,
        33,
        38,
        39,
        40,
        41,
        42,
        43,
        44,
        45,
        56,
        57,
        62,
        63,
        68,
        69,
        74,
        75,
        76,
        77,
        78,
        79,
        80,
        81,
        92,
        93,
        98,
        99,
        112,
        113,
        128,
        129,
        134,
        135,
        148,
        149,
        160,
        161,
        162,
        163,
        164,
        165,
        166,
        167,
        168,
        169,
        170,
        171,
        172,
        173,
        178,
        179,
        184,
        185,
        196,
        197,
        198,
        199,
        200,
        201,
        202,
        203,
        204,
        205,
        206,
        207,
        208,
        209,
        214,
        215,
        220,
        221
      ];
    }
  } catch (error) {
  }
  exports.inspectOpts = Object.keys(process.env).filter((key) => {
    return /^debug_/i.test(key);
  }).reduce((obj, key) => {
    const prop = key.substring(6).toLowerCase().replace(/_([a-z])/g, (_, k) => {
      return k.toUpperCase();
    });
    let val = process.env[key];
    if (/^(yes|on|true|enabled)$/i.test(val)) {
      val = true;
    } else if (/^(no|off|false|disabled)$/i.test(val)) {
      val = false;
    } else if (val === "null") {
      val = null;
    } else {
      val = Number(val);
    }
    obj[prop] = val;
    return obj;
  }, {});
  function useColors() {
    return "colors" in exports.inspectOpts ? Boolean(exports.inspectOpts.colors) : tty.isatty(process.stderr.fd);
  }
  function formatArgs(args) {
    const { namespace: name, useColors: useColors2 } = this;
    if (useColors2) {
      const c = this.color;
      const colorCode = "\x1B[3" + (c < 8 ? c : "8;5;" + c);
      const prefix = `  ${colorCode};1m${name} \x1B[0m`;
      args[0] = prefix + args[0].split(`
`).join(`
` + prefix);
      args.push(colorCode + "m+" + module.exports.humanize(this.diff) + "\x1B[0m");
    } else {
      args[0] = getDate() + name + " " + args[0];
    }
  }
  function getDate() {
    if (exports.inspectOpts.hideDate) {
      return "";
    }
    return new Date().toISOString() + " ";
  }
  function log(...args) {
    return process.stderr.write(util.formatWithOptions(exports.inspectOpts, ...args) + `
`);
  }
  function save(namespaces) {
    if (namespaces) {
      process.env.DEBUG = namespaces;
    } else {
      delete process.env.DEBUG;
    }
  }
  function load() {
    return process.env.DEBUG;
  }
  function init(debug) {
    debug.inspectOpts = {};
    const keys = Object.keys(exports.inspectOpts);
    for (let i = 0;i < keys.length; i++) {
      debug.inspectOpts[keys[i]] = exports.inspectOpts[keys[i]];
    }
  }
  module.exports = require_common()(exports);
  var { formatters } = module.exports;
  formatters.o = function(v) {
    this.inspectOpts.colors = this.useColors;
    return util.inspect(v, this.inspectOpts).split(`
`).map((str) => str.trim()).join(" ");
  };
  formatters.O = function(v) {
    this.inspectOpts.colors = this.useColors;
    return util.inspect(v, this.inspectOpts);
  };
});

// node_modules/debug/src/index.js
var require_src = __commonJS((exports, module) => {
  if (typeof process === "undefined" || process.type === "renderer" || false || process.__nwjs) {
    module.exports = require_browser();
  } else {
    module.exports = require_node();
  }
});

// node_modules/grammy/out/platform.node.js
var require_platform_node = __commonJS((exports) => {
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.defaultAdapter = exports.itrToStream = exports.debug = undefined;
  exports.baseFetchConfig = baseFetchConfig;
  var http_1 = __require("http");
  var https_1 = __require("https");
  var stream_1 = __require("stream");
  var debug_1 = require_src();
  Object.defineProperty(exports, "debug", { enumerable: true, get: function() {
    return debug_1.debug;
  } });
  var itrToStream = (itr) => stream_1.Readable.from(itr, { objectMode: false });
  exports.itrToStream = itrToStream;
  var httpAgents = new Map;
  var httpsAgents = new Map;
  function getCached(map, key, otherwise) {
    let value = map.get(key);
    if (value === undefined) {
      value = otherwise();
      map.set(key, value);
    }
    return value;
  }
  function baseFetchConfig(apiRoot) {
    if (apiRoot.startsWith("https:")) {
      return {
        compress: true,
        agent: getCached(httpsAgents, apiRoot, () => new https_1.Agent({ keepAlive: true }))
      };
    } else if (apiRoot.startsWith("http:")) {
      return {
        agent: getCached(httpAgents, apiRoot, () => new http_1.Agent({ keepAlive: true }))
      };
    } else
      return {};
  }
  exports.defaultAdapter = "express";
});

// node_modules/grammy/out/core/error.js
var require_error = __commonJS((exports) => {
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.HttpError = exports.GrammyError = undefined;
  exports.toGrammyError = toGrammyError;
  exports.toHttpError = toHttpError;
  var platform_node_js_1 = require_platform_node();
  var debug = (0, platform_node_js_1.debug)("grammy:warn");

  class GrammyError extends Error {
    constructor(message, err, method, payload) {
      var _a;
      super(`${message} (${err.error_code}: ${err.description})`);
      this.method = method;
      this.payload = payload;
      this.ok = false;
      this.name = "GrammyError";
      this.error_code = err.error_code;
      this.description = err.description;
      this.parameters = (_a = err.parameters) !== null && _a !== undefined ? _a : {};
    }
  }
  exports.GrammyError = GrammyError;
  function toGrammyError(err, method, payload) {
    switch (err.error_code) {
      case 401:
        debug("Error 401 means that your bot token is wrong, talk to https://t.me/BotFather to check it.");
        break;
      case 409:
        debug("Error 409 means that you are running your bot several times on long polling. Consider revoking the bot token if you believe that no other instance is running.");
        break;
    }
    return new GrammyError(`Call to '${method}' failed!`, err, method, payload);
  }

  class HttpError extends Error {
    constructor(message, error) {
      super(message);
      this.error = error;
      this.name = "HttpError";
    }
  }
  exports.HttpError = HttpError;
  function isTelegramError(err) {
    return typeof err === "object" && err !== null && "status" in err && "statusText" in err;
  }
  function toHttpError(method, sensitiveLogs) {
    return (err) => {
      let msg = `Network request for '${method}' failed!`;
      if (isTelegramError(err))
        msg += ` (${err.status}: ${err.statusText})`;
      if (sensitiveLogs && err instanceof Error)
        msg += ` ${err.message}`;
      throw new HttpError(msg, err);
    };
  }
});

// node_modules/@grammyjs/types/mod.js
var exports_mod = {};

// node_modules/grammy/out/types.node.js
var require_types_node = __commonJS((exports) => {
  var __createBinding = exports && exports.__createBinding || (Object.create ? function(o, m, k, k2) {
    if (k2 === undefined)
      k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() {
        return m[k];
      } };
    }
    Object.defineProperty(o, k2, desc);
  } : function(o, m, k, k2) {
    if (k2 === undefined)
      k2 = k;
    o[k2] = m[k];
  });
  var __exportStar = exports && exports.__exportStar || function(m, exports2) {
    for (var p in m)
      if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports2, p))
        __createBinding(exports2, m, p);
  };
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.InputFile = undefined;
  var fs_1 = __require("fs");
  var node_fetch_1 = __require("node-fetch");
  var path_1 = __require("path");
  var platform_node_1 = require_platform_node();
  var debug = (0, platform_node_1.debug)("grammy:warn");
  __exportStar(__toCommonJS(exports_mod), exports);

  class InputFile {
    constructor(file, filename) {
      this.consumed = false;
      this.fileData = file;
      filename !== null && filename !== undefined || (filename = this.guessFilename(file));
      this.filename = filename;
      if (typeof file === "string" && (file.startsWith("http:") || file.startsWith("https:"))) {
        debug(`InputFile received the local file path '${file}' that looks like a URL. Is this a mistake?`);
      }
    }
    guessFilename(file) {
      if (typeof file === "string")
        return (0, path_1.basename)(file);
      if ("url" in file)
        return (0, path_1.basename)(file.url);
      if (!(file instanceof URL))
        return;
      if (file.pathname !== "/") {
        const filename = (0, path_1.basename)(file.pathname);
        if (filename)
          return filename;
      }
      return (0, path_1.basename)(file.hostname);
    }
    async toRaw() {
      if (this.consumed) {
        throw new Error("Cannot reuse InputFile data source!");
      }
      const data = this.fileData;
      if (typeof data === "string")
        return (0, fs_1.createReadStream)(data);
      if (data instanceof URL) {
        return data.protocol === "file" ? (0, fs_1.createReadStream)(data.pathname) : fetchFile(data);
      }
      if ("url" in data)
        return fetchFile(data.url);
      if (data instanceof Uint8Array)
        return data;
      if (typeof data === "function") {
        return new InputFile(await data()).toRaw();
      }
      this.consumed = true;
      return data;
    }
  }
  exports.InputFile = InputFile;
  async function* fetchFile(url) {
    const { body } = await (0, node_fetch_1.default)(url);
    for await (const chunk of body) {
      if (typeof chunk === "string") {
        throw new Error(`Could not transfer file, received string data instead of bytes from '${url}'`);
      }
      yield chunk;
    }
  }
});

// node_modules/grammy/out/types.js
var require_types = __commonJS((exports) => {
  var __createBinding = exports && exports.__createBinding || (Object.create ? function(o, m, k, k2) {
    if (k2 === undefined)
      k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() {
        return m[k];
      } };
    }
    Object.defineProperty(o, k2, desc);
  } : function(o, m, k, k2) {
    if (k2 === undefined)
      k2 = k;
    o[k2] = m[k];
  });
  var __exportStar = exports && exports.__exportStar || function(m, exports2) {
    for (var p in m)
      if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports2, p))
        __createBinding(exports2, m, p);
  };
  Object.defineProperty(exports, "__esModule", { value: true });
  __exportStar(require_types_node(), exports);
});

// node_modules/grammy/out/core/payload.js
var require_payload = __commonJS((exports) => {
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.requiresFormDataUpload = requiresFormDataUpload;
  exports.createJsonPayload = createJsonPayload;
  exports.createFormDataPayload = createFormDataPayload;
  var platform_node_js_1 = require_platform_node();
  var types_js_1 = require_types();
  function requiresFormDataUpload(payload) {
    return payload instanceof types_js_1.InputFile || typeof payload === "object" && payload !== null && Object.values(payload).some((v) => Array.isArray(v) ? v.some(requiresFormDataUpload) : v instanceof types_js_1.InputFile || requiresFormDataUpload(v));
  }
  function str(value) {
    return JSON.stringify(value, (_, v) => v !== null && v !== undefined ? v : undefined);
  }
  function createJsonPayload(payload) {
    return {
      method: "POST",
      headers: {
        "content-type": "application/json",
        connection: "keep-alive"
      },
      body: str(payload)
    };
  }
  async function* protectItr(itr, onError) {
    try {
      yield* itr;
    } catch (err) {
      onError(err);
    }
  }
  function createFormDataPayload(payload, onError) {
    const boundary = createBoundary();
    const itr = payloadToMultipartItr(payload, boundary);
    const safeItr = protectItr(itr, onError);
    const stream = (0, platform_node_js_1.itrToStream)(safeItr);
    return {
      method: "POST",
      headers: {
        "content-type": `multipart/form-data; boundary=${boundary}`,
        connection: "keep-alive"
      },
      body: stream
    };
  }
  function createBoundary() {
    return "----------" + randomId(32);
  }
  function randomId(length = 16) {
    return Array.from(Array(length)).map(() => Math.random().toString(36)[2] || 0).join("");
  }
  var enc = new TextEncoder;
  async function* payloadToMultipartItr(payload, boundary) {
    const files = extractFiles(payload);
    yield enc.encode(`--${boundary}\r
`);
    const separator = enc.encode(`\r
--${boundary}\r
`);
    let first = true;
    for (const [key, value] of Object.entries(payload)) {
      if (value == null)
        continue;
      if (!first)
        yield separator;
      yield valuePart(key, typeof value === "object" ? str(value) : value);
      first = false;
    }
    for (const { id, origin, file } of files) {
      if (!first)
        yield separator;
      yield* filePart(id, origin, file);
      first = false;
    }
    yield enc.encode(`\r
--${boundary}--\r
`);
  }
  function extractFiles(value) {
    if (typeof value !== "object" || value === null)
      return [];
    return Object.entries(value).flatMap(([k, v]) => {
      if (Array.isArray(v))
        return v.flatMap((p) => extractFiles(p));
      else if (v instanceof types_js_1.InputFile) {
        const id = randomId();
        Object.assign(value, { [k]: `attach://${id}` });
        const origin = k === "media" && "type" in value && typeof value.type === "string" ? value.type : k;
        return { id, origin, file: v };
      } else
        return extractFiles(v);
    });
  }
  function valuePart(key, value) {
    return enc.encode(`content-disposition:form-data;name="${key}"\r
\r
${value}`);
  }
  async function* filePart(id, origin, input) {
    const filename = input.filename || `${origin}.${getExt(origin)}`;
    if (filename.includes("\r") || filename.includes(`
`)) {
      throw new Error(`File paths cannot contain carriage-return (\\r) or newline (\\n) characters! Filename for property '${origin}' was:
"""
${filename}
"""`);
    }
    yield enc.encode(`content-disposition:form-data;name="${id}";filename=${filename}\r
content-type:application/octet-stream\r
\r
`);
    const data = await input.toRaw();
    if (data instanceof Uint8Array)
      yield data;
    else
      yield* data;
  }
  function getExt(key) {
    switch (key) {
      case "certificate":
        return "pem";
      case "photo":
      case "thumbnail":
        return "jpg";
      case "voice":
        return "ogg";
      case "audio":
        return "mp3";
      case "animation":
      case "video":
      case "video_note":
        return "mp4";
      case "sticker":
        return "webp";
      default:
        return "dat";
    }
  }
});

// node_modules/grammy/out/shim.node.js
var require_shim_node = __commonJS((exports) => {
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.fetch = exports.AbortController = undefined;
  var abort_controller_1 = __require("abort-controller");
  Object.defineProperty(exports, "AbortController", { enumerable: true, get: function() {
    return abort_controller_1.AbortController;
  } });
  var node_fetch_1 = __require("node-fetch");
  Object.defineProperty(exports, "fetch", { enumerable: true, get: function() {
    return node_fetch_1.default;
  } });
});

// node_modules/grammy/out/core/client.js
var require_client = __commonJS((exports) => {
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.createRawApi = createRawApi;
  var platform_node_js_1 = require_platform_node();
  var error_js_1 = require_error();
  var payload_js_1 = require_payload();
  var debug = (0, platform_node_js_1.debug)("grammy:core");
  function concatTransformer(prev, trans) {
    return (method, payload, signal) => trans(prev, method, payload, signal);
  }

  class ApiClient {
    constructor(token, options = {}, webhookReplyEnvelope = {}) {
      var _a, _b, _c, _d, _e, _f;
      this.token = token;
      this.webhookReplyEnvelope = webhookReplyEnvelope;
      this.hasUsedWebhookReply = false;
      this.installedTransformers = [];
      this.call = async (method, p, signal) => {
        const payload = p !== null && p !== undefined ? p : {};
        debug(`Calling ${method}`);
        if (signal !== undefined)
          validateSignal(method, payload, signal);
        const opts = this.options;
        const formDataRequired = (0, payload_js_1.requiresFormDataUpload)(payload);
        if (this.webhookReplyEnvelope.send !== undefined && !this.hasUsedWebhookReply && !formDataRequired && opts.canUseWebhookReply(method)) {
          this.hasUsedWebhookReply = true;
          const config2 = (0, payload_js_1.createJsonPayload)({ ...payload, method });
          await this.webhookReplyEnvelope.send(config2.body);
          return { ok: true, result: true };
        }
        const controller = createAbortControllerFromSignal(signal);
        const timeout = createTimeout(controller, opts.timeoutSeconds, method);
        const streamErr = createStreamError(controller);
        const url = opts.buildUrl(opts.apiRoot, this.token, method, opts.environment);
        const config = formDataRequired ? (0, payload_js_1.createFormDataPayload)(payload, (err) => streamErr.catch(err)) : (0, payload_js_1.createJsonPayload)(payload);
        const sig = controller.signal;
        const options2 = { ...opts.baseFetchConfig, signal: sig, ...config };
        const successPromise = this.fetch(url instanceof URL ? url.href : url, options2).catch((0, error_js_1.toHttpError)(method, opts.sensitiveLogs));
        const operations = [successPromise, streamErr.promise, timeout.promise];
        try {
          const res = await Promise.race(operations);
          return await res.json();
        } finally {
          if (timeout.handle !== undefined)
            clearTimeout(timeout.handle);
        }
      };
      const apiRoot = (_a = options.apiRoot) !== null && _a !== undefined ? _a : "https://api.telegram.org";
      const environment = (_b = options.environment) !== null && _b !== undefined ? _b : "prod";
      const { fetch: customFetch } = options;
      const fetchFn = customFetch !== null && customFetch !== undefined ? customFetch : shim_node_js_1.fetch;
      this.options = {
        apiRoot,
        environment,
        buildUrl: (_c = options.buildUrl) !== null && _c !== undefined ? _c : defaultBuildUrl,
        timeoutSeconds: (_d = options.timeoutSeconds) !== null && _d !== undefined ? _d : 500,
        baseFetchConfig: {
          ...(0, platform_node_js_1.baseFetchConfig)(apiRoot),
          ...options.baseFetchConfig
        },
        canUseWebhookReply: (_e = options.canUseWebhookReply) !== null && _e !== undefined ? _e : () => false,
        sensitiveLogs: (_f = options.sensitiveLogs) !== null && _f !== undefined ? _f : false,
        fetch: (...args) => fetchFn(...args)
      };
      this.fetch = this.options.fetch;
      if (this.options.apiRoot.endsWith("/")) {
        throw new Error(`Remove the trailing '/' from the 'apiRoot' option (use '${this.options.apiRoot.substring(0, this.options.apiRoot.length - 1)}' instead of '${this.options.apiRoot}')`);
      }
    }
    use(...transformers) {
      this.call = transformers.reduce(concatTransformer, this.call);
      this.installedTransformers.push(...transformers);
      return this;
    }
    async callApi(method, payload, signal) {
      const data = await this.call(method, payload, signal);
      if (data.ok)
        return data.result;
      else
        throw (0, error_js_1.toGrammyError)(data, method, payload);
    }
  }
  function createRawApi(token, options, webhookReplyEnvelope) {
    const client = new ApiClient(token, options, webhookReplyEnvelope);
    const proxyHandler = {
      get(_, m) {
        return m === "toJSON" ? "__internal" : m === "getMe" || m === "getWebhookInfo" || m === "getForumTopicIconStickers" || m === "getAvailableGifts" || m === "logOut" || m === "close" ? client.callApi.bind(client, m, {}) : client.callApi.bind(client, m);
      },
      ...proxyMethods
    };
    const raw = new Proxy({}, proxyHandler);
    const installedTransformers = client.installedTransformers;
    const api = {
      raw,
      installedTransformers,
      use: (...t) => {
        client.use(...t);
        return api;
      }
    };
    return api;
  }
  var defaultBuildUrl = (root, token, method, env) => {
    const prefix = env === "test" ? "test/" : "";
    return `${root}/bot${token}/${prefix}${method}`;
  };
  var proxyMethods = {
    set() {
      return false;
    },
    defineProperty() {
      return false;
    },
    deleteProperty() {
      return false;
    },
    ownKeys() {
      return [];
    }
  };
  function createTimeout(controller, seconds, method) {
    let handle = undefined;
    const promise = new Promise((_, reject) => {
      handle = setTimeout(() => {
        const msg = `Request to '${method}' timed out after ${seconds} seconds`;
        reject(new Error(msg));
        controller.abort();
      }, 1000 * seconds);
    });
    return { promise, handle };
  }
  function createStreamError(abortController) {
    let onError = (err) => {
      throw err;
    };
    const promise = new Promise((_, reject) => {
      onError = (err) => {
        reject(err);
        abortController.abort();
      };
    });
    return { promise, catch: onError };
  }
  function createAbortControllerFromSignal(signal) {
    const abortController = new shim_node_js_1.AbortController;
    if (signal === undefined)
      return abortController;
    const sig = signal;
    function abort() {
      abortController.abort();
      sig.removeEventListener("abort", abort);
    }
    if (sig.aborted)
      abort();
    else
      sig.addEventListener("abort", abort);
    return { abort, signal: abortController.signal };
  }
  function validateSignal(method, payload, signal) {
    if (typeof (signal === null || signal === undefined ? undefined : signal.addEventListener) === "function") {
      return;
    }
    let payload0 = JSON.stringify(payload);
    if (payload0.length > 20) {
      payload0 = payload0.substring(0, 16) + " ...";
    }
    let payload1 = JSON.stringify(signal);
    if (payload1.length > 20) {
      payload1 = payload1.substring(0, 16) + " ...";
    }
    throw new Error(`Incorrect abort signal instance found! You passed two payloads to '${method}' but you should merge the second one containing '${payload1}' into the first one containing '${payload0}'! If you are using context shortcuts, you may want to use a method on 'ctx.api' instead.

If you want to prevent such mistakes in the future, consider using TypeScript. https://www.typescriptlang.org/`);
  }
  var shim_node_js_1 = require_shim_node();
});

// node_modules/grammy/out/core/api.js
var require_api = __commonJS((exports) => {
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.Api = undefined;
  var client_js_1 = require_client();

  class Api {
    constructor(token, options, webhookReplyEnvelope) {
      this.token = token;
      this.options = options;
      const { raw, use, installedTransformers } = (0, client_js_1.createRawApi)(token, options, webhookReplyEnvelope);
      this.raw = raw;
      this.config = {
        use,
        installedTransformers: () => installedTransformers.slice()
      };
    }
    getUpdates(other, signal) {
      return this.raw.getUpdates({ ...other }, signal);
    }
    setWebhook(url, other, signal) {
      return this.raw.setWebhook({ url, ...other }, signal);
    }
    deleteWebhook(other, signal) {
      return this.raw.deleteWebhook({ ...other }, signal);
    }
    getWebhookInfo(signal) {
      return this.raw.getWebhookInfo(signal);
    }
    getMe(signal) {
      return this.raw.getMe(signal);
    }
    logOut(signal) {
      return this.raw.logOut(signal);
    }
    close(signal) {
      return this.raw.close(signal);
    }
    sendMessage(chat_id, text, other, signal) {
      return this.raw.sendMessage({ chat_id, text, ...other }, signal);
    }
    forwardMessage(chat_id, from_chat_id, message_id, other, signal) {
      return this.raw.forwardMessage({ chat_id, from_chat_id, message_id, ...other }, signal);
    }
    forwardMessages(chat_id, from_chat_id, message_ids, other, signal) {
      return this.raw.forwardMessages({
        chat_id,
        from_chat_id,
        message_ids,
        ...other
      }, signal);
    }
    copyMessage(chat_id, from_chat_id, message_id, other, signal) {
      return this.raw.copyMessage({ chat_id, from_chat_id, message_id, ...other }, signal);
    }
    copyMessages(chat_id, from_chat_id, message_ids, other, signal) {
      return this.raw.copyMessages({
        chat_id,
        from_chat_id,
        message_ids,
        ...other
      }, signal);
    }
    sendPhoto(chat_id, photo, other, signal) {
      return this.raw.sendPhoto({ chat_id, photo, ...other }, signal);
    }
    sendAudio(chat_id, audio, other, signal) {
      return this.raw.sendAudio({ chat_id, audio, ...other }, signal);
    }
    sendDocument(chat_id, document2, other, signal) {
      return this.raw.sendDocument({ chat_id, document: document2, ...other }, signal);
    }
    sendVideo(chat_id, video, other, signal) {
      return this.raw.sendVideo({ chat_id, video, ...other }, signal);
    }
    sendAnimation(chat_id, animation, other, signal) {
      return this.raw.sendAnimation({ chat_id, animation, ...other }, signal);
    }
    sendVoice(chat_id, voice, other, signal) {
      return this.raw.sendVoice({ chat_id, voice, ...other }, signal);
    }
    sendVideoNote(chat_id, video_note, other, signal) {
      return this.raw.sendVideoNote({ chat_id, video_note, ...other }, signal);
    }
    sendMediaGroup(chat_id, media, other, signal) {
      return this.raw.sendMediaGroup({ chat_id, media, ...other }, signal);
    }
    sendLocation(chat_id, latitude, longitude, other, signal) {
      return this.raw.sendLocation({ chat_id, latitude, longitude, ...other }, signal);
    }
    editMessageLiveLocation(chat_id, message_id, latitude, longitude, other, signal) {
      return this.raw.editMessageLiveLocation({ chat_id, message_id, latitude, longitude, ...other }, signal);
    }
    editMessageLiveLocationInline(inline_message_id, latitude, longitude, other, signal) {
      return this.raw.editMessageLiveLocation({ inline_message_id, latitude, longitude, ...other }, signal);
    }
    stopMessageLiveLocation(chat_id, message_id, other, signal) {
      return this.raw.stopMessageLiveLocation({ chat_id, message_id, ...other }, signal);
    }
    stopMessageLiveLocationInline(inline_message_id, other, signal) {
      return this.raw.stopMessageLiveLocation({ inline_message_id, ...other }, signal);
    }
    sendPaidMedia(chat_id, star_count, media, other, signal) {
      return this.raw.sendPaidMedia({ chat_id, star_count, media, ...other }, signal);
    }
    sendVenue(chat_id, latitude, longitude, title, address, other, signal) {
      return this.raw.sendVenue({ chat_id, latitude, longitude, title, address, ...other }, signal);
    }
    sendContact(chat_id, phone_number, first_name, other, signal) {
      return this.raw.sendContact({ chat_id, phone_number, first_name, ...other }, signal);
    }
    sendPoll(chat_id, question, options, other, signal) {
      return this.raw.sendPoll({ chat_id, question, options, ...other }, signal);
    }
    sendDice(chat_id, emoji, other, signal) {
      return this.raw.sendDice({ chat_id, emoji, ...other }, signal);
    }
    setMessageReaction(chat_id, message_id, reaction, other, signal) {
      return this.raw.setMessageReaction({
        chat_id,
        message_id,
        reaction,
        ...other
      }, signal);
    }
    sendChatAction(chat_id, action, other, signal) {
      return this.raw.sendChatAction({ chat_id, action, ...other }, signal);
    }
    getUserProfilePhotos(user_id, other, signal) {
      return this.raw.getUserProfilePhotos({ user_id, ...other }, signal);
    }
    setUserEmojiStatus(user_id, other, signal) {
      return this.raw.setUserEmojiStatus({ user_id, ...other }, signal);
    }
    getUserChatBoosts(chat_id, user_id, signal) {
      return this.raw.getUserChatBoosts({ chat_id, user_id }, signal);
    }
    getBusinessConnection(business_connection_id, signal) {
      return this.raw.getBusinessConnection({ business_connection_id }, signal);
    }
    getFile(file_id, signal) {
      return this.raw.getFile({ file_id }, signal);
    }
    kickChatMember(...args) {
      return this.banChatMember(...args);
    }
    banChatMember(chat_id, user_id, other, signal) {
      return this.raw.banChatMember({ chat_id, user_id, ...other }, signal);
    }
    unbanChatMember(chat_id, user_id, other, signal) {
      return this.raw.unbanChatMember({ chat_id, user_id, ...other }, signal);
    }
    restrictChatMember(chat_id, user_id, permissions, other, signal) {
      return this.raw.restrictChatMember({ chat_id, user_id, permissions, ...other }, signal);
    }
    promoteChatMember(chat_id, user_id, other, signal) {
      return this.raw.promoteChatMember({ chat_id, user_id, ...other }, signal);
    }
    setChatAdministratorCustomTitle(chat_id, user_id, custom_title, signal) {
      return this.raw.setChatAdministratorCustomTitle({ chat_id, user_id, custom_title }, signal);
    }
    banChatSenderChat(chat_id, sender_chat_id, signal) {
      return this.raw.banChatSenderChat({ chat_id, sender_chat_id }, signal);
    }
    unbanChatSenderChat(chat_id, sender_chat_id, signal) {
      return this.raw.unbanChatSenderChat({ chat_id, sender_chat_id }, signal);
    }
    setChatPermissions(chat_id, permissions, other, signal) {
      return this.raw.setChatPermissions({ chat_id, permissions, ...other }, signal);
    }
    exportChatInviteLink(chat_id, signal) {
      return this.raw.exportChatInviteLink({ chat_id }, signal);
    }
    createChatInviteLink(chat_id, other, signal) {
      return this.raw.createChatInviteLink({ chat_id, ...other }, signal);
    }
    editChatInviteLink(chat_id, invite_link, other, signal) {
      return this.raw.editChatInviteLink({ chat_id, invite_link, ...other }, signal);
    }
    createChatSubscriptionInviteLink(chat_id, subscription_period, subscription_price, other, signal) {
      return this.raw.createChatSubscriptionInviteLink({ chat_id, subscription_period, subscription_price, ...other }, signal);
    }
    editChatSubscriptionInviteLink(chat_id, invite_link, other, signal) {
      return this.raw.editChatSubscriptionInviteLink({ chat_id, invite_link, ...other }, signal);
    }
    revokeChatInviteLink(chat_id, invite_link, signal) {
      return this.raw.revokeChatInviteLink({ chat_id, invite_link }, signal);
    }
    approveChatJoinRequest(chat_id, user_id, signal) {
      return this.raw.approveChatJoinRequest({ chat_id, user_id }, signal);
    }
    declineChatJoinRequest(chat_id, user_id, signal) {
      return this.raw.declineChatJoinRequest({ chat_id, user_id }, signal);
    }
    setChatPhoto(chat_id, photo, signal) {
      return this.raw.setChatPhoto({ chat_id, photo }, signal);
    }
    deleteChatPhoto(chat_id, signal) {
      return this.raw.deleteChatPhoto({ chat_id }, signal);
    }
    setChatTitle(chat_id, title, signal) {
      return this.raw.setChatTitle({ chat_id, title }, signal);
    }
    setChatDescription(chat_id, description, signal) {
      return this.raw.setChatDescription({ chat_id, description }, signal);
    }
    pinChatMessage(chat_id, message_id, other, signal) {
      return this.raw.pinChatMessage({ chat_id, message_id, ...other }, signal);
    }
    unpinChatMessage(chat_id, message_id, signal) {
      return this.raw.unpinChatMessage({ chat_id, message_id }, signal);
    }
    unpinAllChatMessages(chat_id, signal) {
      return this.raw.unpinAllChatMessages({ chat_id }, signal);
    }
    leaveChat(chat_id, signal) {
      return this.raw.leaveChat({ chat_id }, signal);
    }
    getChat(chat_id, signal) {
      return this.raw.getChat({ chat_id }, signal);
    }
    getChatAdministrators(chat_id, signal) {
      return this.raw.getChatAdministrators({ chat_id }, signal);
    }
    getChatMembersCount(...args) {
      return this.getChatMemberCount(...args);
    }
    getChatMemberCount(chat_id, signal) {
      return this.raw.getChatMemberCount({ chat_id }, signal);
    }
    getChatMember(chat_id, user_id, signal) {
      return this.raw.getChatMember({ chat_id, user_id }, signal);
    }
    setChatStickerSet(chat_id, sticker_set_name, signal) {
      return this.raw.setChatStickerSet({ chat_id, sticker_set_name }, signal);
    }
    deleteChatStickerSet(chat_id, signal) {
      return this.raw.deleteChatStickerSet({ chat_id }, signal);
    }
    getForumTopicIconStickers(signal) {
      return this.raw.getForumTopicIconStickers(signal);
    }
    createForumTopic(chat_id, name, other, signal) {
      return this.raw.createForumTopic({ chat_id, name, ...other }, signal);
    }
    editForumTopic(chat_id, message_thread_id, other, signal) {
      return this.raw.editForumTopic({ chat_id, message_thread_id, ...other }, signal);
    }
    closeForumTopic(chat_id, message_thread_id, signal) {
      return this.raw.closeForumTopic({ chat_id, message_thread_id }, signal);
    }
    reopenForumTopic(chat_id, message_thread_id, signal) {
      return this.raw.reopenForumTopic({ chat_id, message_thread_id }, signal);
    }
    deleteForumTopic(chat_id, message_thread_id, signal) {
      return this.raw.deleteForumTopic({ chat_id, message_thread_id }, signal);
    }
    unpinAllForumTopicMessages(chat_id, message_thread_id, signal) {
      return this.raw.unpinAllForumTopicMessages({ chat_id, message_thread_id }, signal);
    }
    editGeneralForumTopic(chat_id, name, signal) {
      return this.raw.editGeneralForumTopic({ chat_id, name }, signal);
    }
    closeGeneralForumTopic(chat_id, signal) {
      return this.raw.closeGeneralForumTopic({ chat_id }, signal);
    }
    reopenGeneralForumTopic(chat_id, signal) {
      return this.raw.reopenGeneralForumTopic({ chat_id }, signal);
    }
    hideGeneralForumTopic(chat_id, signal) {
      return this.raw.hideGeneralForumTopic({ chat_id }, signal);
    }
    unhideGeneralForumTopic(chat_id, signal) {
      return this.raw.unhideGeneralForumTopic({ chat_id }, signal);
    }
    unpinAllGeneralForumTopicMessages(chat_id, signal) {
      return this.raw.unpinAllGeneralForumTopicMessages({ chat_id }, signal);
    }
    answerCallbackQuery(callback_query_id, other, signal) {
      return this.raw.answerCallbackQuery({ callback_query_id, ...other }, signal);
    }
    setMyName(name, other, signal) {
      return this.raw.setMyName({ name, ...other }, signal);
    }
    getMyName(other, signal) {
      return this.raw.getMyName(other !== null && other !== undefined ? other : {}, signal);
    }
    setMyCommands(commands, other, signal) {
      return this.raw.setMyCommands({ commands, ...other }, signal);
    }
    deleteMyCommands(other, signal) {
      return this.raw.deleteMyCommands({ ...other }, signal);
    }
    getMyCommands(other, signal) {
      return this.raw.getMyCommands({ ...other }, signal);
    }
    setMyDescription(description, other, signal) {
      return this.raw.setMyDescription({ description, ...other }, signal);
    }
    getMyDescription(other, signal) {
      return this.raw.getMyDescription({ ...other }, signal);
    }
    setMyShortDescription(short_description, other, signal) {
      return this.raw.setMyShortDescription({ short_description, ...other }, signal);
    }
    getMyShortDescription(other, signal) {
      return this.raw.getMyShortDescription({ ...other }, signal);
    }
    setChatMenuButton(other, signal) {
      return this.raw.setChatMenuButton({ ...other }, signal);
    }
    getChatMenuButton(other, signal) {
      return this.raw.getChatMenuButton({ ...other }, signal);
    }
    setMyDefaultAdministratorRights(other, signal) {
      return this.raw.setMyDefaultAdministratorRights({ ...other }, signal);
    }
    getMyDefaultAdministratorRights(other, signal) {
      return this.raw.getMyDefaultAdministratorRights({ ...other }, signal);
    }
    editMessageText(chat_id, message_id, text, other, signal) {
      return this.raw.editMessageText({ chat_id, message_id, text, ...other }, signal);
    }
    editMessageTextInline(inline_message_id, text, other, signal) {
      return this.raw.editMessageText({ inline_message_id, text, ...other }, signal);
    }
    editMessageCaption(chat_id, message_id, other, signal) {
      return this.raw.editMessageCaption({ chat_id, message_id, ...other }, signal);
    }
    editMessageCaptionInline(inline_message_id, other, signal) {
      return this.raw.editMessageCaption({ inline_message_id, ...other }, signal);
    }
    editMessageMedia(chat_id, message_id, media, other, signal) {
      return this.raw.editMessageMedia({ chat_id, message_id, media, ...other }, signal);
    }
    editMessageMediaInline(inline_message_id, media, other, signal) {
      return this.raw.editMessageMedia({ inline_message_id, media, ...other }, signal);
    }
    editMessageReplyMarkup(chat_id, message_id, other, signal) {
      return this.raw.editMessageReplyMarkup({ chat_id, message_id, ...other }, signal);
    }
    editMessageReplyMarkupInline(inline_message_id, other, signal) {
      return this.raw.editMessageReplyMarkup({ inline_message_id, ...other }, signal);
    }
    stopPoll(chat_id, message_id, other, signal) {
      return this.raw.stopPoll({ chat_id, message_id, ...other }, signal);
    }
    deleteMessage(chat_id, message_id, signal) {
      return this.raw.deleteMessage({ chat_id, message_id }, signal);
    }
    deleteMessages(chat_id, message_ids, signal) {
      return this.raw.deleteMessages({ chat_id, message_ids }, signal);
    }
    sendSticker(chat_id, sticker, other, signal) {
      return this.raw.sendSticker({ chat_id, sticker, ...other }, signal);
    }
    getStickerSet(name, signal) {
      return this.raw.getStickerSet({ name }, signal);
    }
    getCustomEmojiStickers(custom_emoji_ids, signal) {
      return this.raw.getCustomEmojiStickers({ custom_emoji_ids }, signal);
    }
    uploadStickerFile(user_id, sticker_format, sticker, signal) {
      return this.raw.uploadStickerFile({ user_id, sticker_format, sticker }, signal);
    }
    createNewStickerSet(user_id, name, title, stickers, other, signal) {
      return this.raw.createNewStickerSet({ user_id, name, title, stickers, ...other }, signal);
    }
    addStickerToSet(user_id, name, sticker, signal) {
      return this.raw.addStickerToSet({ user_id, name, sticker }, signal);
    }
    setStickerPositionInSet(sticker, position, signal) {
      return this.raw.setStickerPositionInSet({ sticker, position }, signal);
    }
    deleteStickerFromSet(sticker, signal) {
      return this.raw.deleteStickerFromSet({ sticker }, signal);
    }
    replaceStickerInSet(user_id, name, old_sticker, sticker, signal) {
      return this.raw.replaceStickerInSet({ user_id, name, old_sticker, sticker }, signal);
    }
    setStickerEmojiList(sticker, emoji_list, signal) {
      return this.raw.setStickerEmojiList({ sticker, emoji_list }, signal);
    }
    setStickerKeywords(sticker, keywords, signal) {
      return this.raw.setStickerKeywords({ sticker, keywords }, signal);
    }
    setStickerMaskPosition(sticker, mask_position, signal) {
      return this.raw.setStickerMaskPosition({ sticker, mask_position }, signal);
    }
    setStickerSetTitle(name, title, signal) {
      return this.raw.setStickerSetTitle({ name, title }, signal);
    }
    deleteStickerSet(name, signal) {
      return this.raw.deleteStickerSet({ name }, signal);
    }
    setStickerSetThumbnail(name, user_id, thumbnail, format, signal) {
      return this.raw.setStickerSetThumbnail({ name, user_id, thumbnail, format }, signal);
    }
    setCustomEmojiStickerSetThumbnail(name, custom_emoji_id, signal) {
      return this.raw.setCustomEmojiStickerSetThumbnail({
        name,
        custom_emoji_id
      }, signal);
    }
    getAvailableGifts(signal) {
      return this.raw.getAvailableGifts(signal);
    }
    sendGift(user_id, gift_id, other, signal) {
      return this.raw.sendGift({ user_id, gift_id, ...other }, signal);
    }
    answerInlineQuery(inline_query_id, results, other, signal) {
      return this.raw.answerInlineQuery({ inline_query_id, results, ...other }, signal);
    }
    answerWebAppQuery(web_app_query_id, result, signal) {
      return this.raw.answerWebAppQuery({ web_app_query_id, result }, signal);
    }
    savePreparedInlineMessage(user_id, result, other, signal) {
      return this.raw.savePreparedInlineMessage({ user_id, result, ...other }, signal);
    }
    sendInvoice(chat_id, title, description, payload, currency, prices, other, signal) {
      return this.raw.sendInvoice({
        chat_id,
        title,
        description,
        payload,
        currency,
        prices,
        ...other
      }, signal);
    }
    createInvoiceLink(title, description, payload, provider_token, currency, prices, other, signal) {
      return this.raw.createInvoiceLink({
        title,
        description,
        payload,
        provider_token,
        currency,
        prices,
        ...other
      }, signal);
    }
    answerShippingQuery(shipping_query_id, ok, other, signal) {
      return this.raw.answerShippingQuery({ shipping_query_id, ok, ...other }, signal);
    }
    answerPreCheckoutQuery(pre_checkout_query_id, ok, other, signal) {
      return this.raw.answerPreCheckoutQuery({ pre_checkout_query_id, ok, ...other }, signal);
    }
    getStarTransactions(other, signal) {
      return this.raw.getStarTransactions({ ...other }, signal);
    }
    refundStarPayment(user_id, telegram_payment_charge_id, signal) {
      return this.raw.refundStarPayment({ user_id, telegram_payment_charge_id }, signal);
    }
    editUserStarSubscription(user_id, telegram_payment_charge_id, is_canceled, signal) {
      return this.raw.editUserStarSubscription({ user_id, telegram_payment_charge_id, is_canceled }, signal);
    }
    verifyUser(user_id, other, signal) {
      return this.raw.verifyUser({ user_id, ...other }, signal);
    }
    verifyChat(chat_id, other, signal) {
      return this.raw.verifyChat({ chat_id, ...other }, signal);
    }
    removeUserVerification(user_id, signal) {
      return this.raw.removeUserVerification({ user_id }, signal);
    }
    removeChatVerification(chat_id, signal) {
      return this.raw.removeChatVerification({ chat_id }, signal);
    }
    setPassportDataErrors(user_id, errors, signal) {
      return this.raw.setPassportDataErrors({ user_id, errors }, signal);
    }
    sendGame(chat_id, game_short_name, other, signal) {
      return this.raw.sendGame({ chat_id, game_short_name, ...other }, signal);
    }
    setGameScore(chat_id, message_id, user_id, score, other, signal) {
      return this.raw.setGameScore({ chat_id, message_id, user_id, score, ...other }, signal);
    }
    setGameScoreInline(inline_message_id, user_id, score, other, signal) {
      return this.raw.setGameScore({ inline_message_id, user_id, score, ...other }, signal);
    }
    getGameHighScores(chat_id, message_id, user_id, signal) {
      return this.raw.getGameHighScores({ chat_id, message_id, user_id }, signal);
    }
    getGameHighScoresInline(inline_message_id, user_id, signal) {
      return this.raw.getGameHighScores({ inline_message_id, user_id }, signal);
    }
  }
  exports.Api = Api;
});

// node_modules/grammy/out/bot.js
var require_bot = __commonJS((exports) => {
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.Bot = exports.BotError = exports.DEFAULT_UPDATE_TYPES = undefined;
  var composer_js_1 = require_composer();
  Object.defineProperty(exports, "BotError", { enumerable: true, get: function() {
    return composer_js_1.BotError;
  } });
  var context_js_1 = require_context();
  var api_js_1 = require_api();
  var error_js_1 = require_error();
  var filter_js_1 = require_filter();
  var platform_node_js_1 = require_platform_node();
  var debug = (0, platform_node_js_1.debug)("grammy:bot");
  var debugWarn = (0, platform_node_js_1.debug)("grammy:warn");
  var debugErr = (0, platform_node_js_1.debug)("grammy:error");
  exports.DEFAULT_UPDATE_TYPES = [
    "message",
    "edited_message",
    "channel_post",
    "edited_channel_post",
    "business_connection",
    "business_message",
    "edited_business_message",
    "deleted_business_messages",
    "inline_query",
    "chosen_inline_result",
    "callback_query",
    "shipping_query",
    "pre_checkout_query",
    "poll",
    "poll_answer",
    "my_chat_member",
    "chat_join_request",
    "chat_boost",
    "removed_chat_boost"
  ];

  class Bot extends composer_js_1.Composer {
    constructor(token, config) {
      var _a;
      super();
      this.token = token;
      this.pollingRunning = false;
      this.lastTriedUpdateId = 0;
      this.observedUpdateTypes = new Set;
      this.errorHandler = async (err) => {
        var _a2, _b;
        console.error("Error in middleware while handling update", (_b = (_a2 = err.ctx) === null || _a2 === undefined ? undefined : _a2.update) === null || _b === undefined ? undefined : _b.update_id, err.error);
        console.error("No error handler was set!");
        console.error("Set your own error handler with `bot.catch = ...`");
        if (this.pollingRunning) {
          console.error("Stopping bot");
          await this.stop();
        }
        throw err;
      };
      if (!token)
        throw new Error("Empty token!");
      this.me = config === null || config === undefined ? undefined : config.botInfo;
      this.clientConfig = config === null || config === undefined ? undefined : config.client;
      this.ContextConstructor = (_a = config === null || config === undefined ? undefined : config.ContextConstructor) !== null && _a !== undefined ? _a : context_js_1.Context;
      this.api = new api_js_1.Api(token, this.clientConfig);
    }
    set botInfo(botInfo) {
      this.me = botInfo;
    }
    get botInfo() {
      if (this.me === undefined) {
        throw new Error("Bot information unavailable! Make sure to call `await bot.init()` before accessing `bot.botInfo`!");
      }
      return this.me;
    }
    on(filter, ...middleware) {
      for (const [u] of (0, filter_js_1.parse)(filter).flatMap(filter_js_1.preprocess)) {
        this.observedUpdateTypes.add(u);
      }
      return super.on(filter, ...middleware);
    }
    reaction(reaction, ...middleware) {
      this.observedUpdateTypes.add("message_reaction");
      return super.reaction(reaction, ...middleware);
    }
    isInited() {
      return this.me !== undefined;
    }
    async init(signal) {
      var _a;
      if (!this.isInited()) {
        debug("Initializing bot");
        (_a = this.mePromise) !== null && _a !== undefined || (this.mePromise = withRetries(() => this.api.getMe(signal), signal));
        let me;
        try {
          me = await this.mePromise;
        } finally {
          this.mePromise = undefined;
        }
        if (this.me === undefined)
          this.me = me;
        else
          debug("Bot info was set by now, will not overwrite");
      }
      debug(`I am ${this.me.username}!`);
    }
    async handleUpdates(updates) {
      for (const update of updates) {
        this.lastTriedUpdateId = update.update_id;
        try {
          await this.handleUpdate(update);
        } catch (err) {
          if (err instanceof composer_js_1.BotError) {
            await this.errorHandler(err);
          } else {
            console.error("FATAL: grammY unable to handle:", err);
            throw err;
          }
        }
      }
    }
    async handleUpdate(update, webhookReplyEnvelope) {
      if (this.me === undefined) {
        throw new Error("Bot not initialized! Either call `await bot.init()`, or directly set the `botInfo` option in the `Bot` constructor to specify a known bot info object.");
      }
      debug(`Processing update ${update.update_id}`);
      const api = new api_js_1.Api(this.token, this.clientConfig, webhookReplyEnvelope);
      const t = this.api.config.installedTransformers();
      if (t.length > 0)
        api.config.use(...t);
      const ctx = new this.ContextConstructor(update, api, this.me);
      try {
        await (0, composer_js_1.run)(this.middleware(), ctx);
      } catch (err) {
        debugErr(`Error in middleware for update ${update.update_id}`);
        throw new composer_js_1.BotError(err, ctx);
      }
    }
    async start(options) {
      var _a, _b, _c;
      const setup = [];
      if (!this.isInited()) {
        setup.push(this.init((_a = this.pollingAbortController) === null || _a === undefined ? undefined : _a.signal));
      }
      if (this.pollingRunning) {
        await Promise.all(setup);
        debug("Simple long polling already running!");
        return;
      }
      this.pollingRunning = true;
      this.pollingAbortController = new shim_node_js_1.AbortController;
      try {
        setup.push(withRetries(async () => {
          var _a2;
          await this.api.deleteWebhook({
            drop_pending_updates: options === null || options === undefined ? undefined : options.drop_pending_updates
          }, (_a2 = this.pollingAbortController) === null || _a2 === undefined ? undefined : _a2.signal);
        }, (_b = this.pollingAbortController) === null || _b === undefined ? undefined : _b.signal));
        await Promise.all(setup);
        await ((_c = options === null || options === undefined ? undefined : options.onStart) === null || _c === undefined ? undefined : _c.call(options, this.botInfo));
      } catch (err) {
        this.pollingRunning = false;
        this.pollingAbortController = undefined;
        throw err;
      }
      if (!this.pollingRunning)
        return;
      validateAllowedUpdates(this.observedUpdateTypes, options === null || options === undefined ? undefined : options.allowed_updates);
      this.use = noUseFunction;
      debug("Starting simple long polling");
      await this.loop(options);
      debug("Middleware is done running");
    }
    async stop() {
      var _a;
      if (this.pollingRunning) {
        debug("Stopping bot, saving update offset");
        this.pollingRunning = false;
        (_a = this.pollingAbortController) === null || _a === undefined || _a.abort();
        const offset = this.lastTriedUpdateId + 1;
        await this.api.getUpdates({ offset, limit: 1 }).finally(() => this.pollingAbortController = undefined);
      } else {
        debug("Bot is not running!");
      }
    }
    isRunning() {
      return this.pollingRunning;
    }
    catch(errorHandler) {
      this.errorHandler = errorHandler;
    }
    async loop(options) {
      var _a, _b;
      const limit = options === null || options === undefined ? undefined : options.limit;
      const timeout = (_a = options === null || options === undefined ? undefined : options.timeout) !== null && _a !== undefined ? _a : 30;
      let allowed_updates = (_b = options === null || options === undefined ? undefined : options.allowed_updates) !== null && _b !== undefined ? _b : [];
      try {
        while (this.pollingRunning) {
          const updates = await this.fetchUpdates({ limit, timeout, allowed_updates });
          if (updates === undefined)
            break;
          await this.handleUpdates(updates);
          allowed_updates = undefined;
        }
      } finally {
        this.pollingRunning = false;
      }
    }
    async fetchUpdates({ limit, timeout, allowed_updates }) {
      var _a;
      const offset = this.lastTriedUpdateId + 1;
      let updates = undefined;
      do {
        try {
          updates = await this.api.getUpdates({ offset, limit, timeout, allowed_updates }, (_a = this.pollingAbortController) === null || _a === undefined ? undefined : _a.signal);
        } catch (error) {
          await this.handlePollingError(error);
        }
      } while (updates === undefined && this.pollingRunning);
      return updates;
    }
    async handlePollingError(error) {
      var _a;
      if (!this.pollingRunning) {
        debug("Pending getUpdates request cancelled");
        return;
      }
      let sleepSeconds = 3;
      if (error instanceof error_js_1.GrammyError) {
        debugErr(error.message);
        if (error.error_code === 401 || error.error_code === 409) {
          throw error;
        } else if (error.error_code === 429) {
          debugErr("Bot API server is closing.");
          sleepSeconds = (_a = error.parameters.retry_after) !== null && _a !== undefined ? _a : sleepSeconds;
        }
      } else
        debugErr(error);
      debugErr(`Call to getUpdates failed, retrying in ${sleepSeconds} seconds ...`);
      await sleep(sleepSeconds);
    }
  }
  exports.Bot = Bot;
  async function withRetries(task, signal) {
    const INITIAL_DELAY = 50;
    let lastDelay = INITIAL_DELAY;
    async function handleError(error) {
      let delay = false;
      let strategy = "rethrow";
      if (error instanceof error_js_1.HttpError) {
        delay = true;
        strategy = "retry";
      } else if (error instanceof error_js_1.GrammyError) {
        if (error.error_code >= 500) {
          delay = true;
          strategy = "retry";
        } else if (error.error_code === 429) {
          const retryAfter = error.parameters.retry_after;
          if (typeof retryAfter === "number") {
            await sleep(retryAfter, signal);
            lastDelay = INITIAL_DELAY;
          } else {
            delay = true;
          }
          strategy = "retry";
        }
      }
      if (delay) {
        if (lastDelay !== INITIAL_DELAY) {
          await sleep(lastDelay, signal);
        }
        const TWENTY_MINUTES = 20 * 60 * 1000;
        lastDelay = Math.min(TWENTY_MINUTES, 2 * lastDelay);
      }
      return strategy;
    }
    let result = { ok: false };
    while (!result.ok) {
      try {
        result = { ok: true, value: await task() };
      } catch (error) {
        debugErr(error);
        const strategy = await handleError(error);
        switch (strategy) {
          case "retry":
            continue;
          case "rethrow":
            throw error;
        }
      }
    }
    return result.value;
  }
  async function sleep(seconds, signal) {
    let handle;
    let reject;
    function abort() {
      reject === null || reject === undefined || reject(new Error("Aborted delay"));
      if (handle !== undefined)
        clearTimeout(handle);
    }
    try {
      await new Promise((res, rej) => {
        reject = rej;
        if (signal === null || signal === undefined ? undefined : signal.aborted) {
          abort();
          return;
        }
        signal === null || signal === undefined || signal.addEventListener("abort", abort);
        handle = setTimeout(res, 1000 * seconds);
      });
    } finally {
      signal === null || signal === undefined || signal.removeEventListener("abort", abort);
    }
  }
  function validateAllowedUpdates(updates, allowed = exports.DEFAULT_UPDATE_TYPES) {
    const impossible = Array.from(updates).filter((u) => !allowed.includes(u));
    if (impossible.length > 0) {
      debugWarn(`You registered listeners for the following update types, but you did not specify them in \`allowed_updates\` so they may not be received: ${impossible.map((u) => `'${u}'`).join(", ")}`);
    }
  }
  function noUseFunction() {
    throw new Error(`It looks like you are registering more listeners on your bot from within other listeners! This means that every time your bot handles a message like this one, new listeners will be added. This list grows until your machine crashes, so grammY throws this error to tell you that you should probably do things a bit differently. If you're unsure how to resolve this problem, you can ask in the group chat: https://telegram.me/grammyjs

On the other hand, if you actually know what you're doing and you do need to install further middleware while your bot is running, consider installing a composer instance on your bot, and in turn augment the composer after the fact. This way, you can circumvent this protection against memory leaks.`);
  }
  var shim_node_js_1 = require_shim_node();
});

// node_modules/grammy/out/convenience/constants.js
var require_constants = __commonJS((exports) => {
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.API_CONSTANTS = undefined;
  var bot_js_1 = require_bot();
  var ALL_UPDATE_TYPES = [
    ...bot_js_1.DEFAULT_UPDATE_TYPES,
    "chat_member",
    "message_reaction",
    "message_reaction_count"
  ];
  var ALL_CHAT_PERMISSIONS = {
    is_anonymous: true,
    can_manage_chat: true,
    can_delete_messages: true,
    can_manage_video_chats: true,
    can_restrict_members: true,
    can_promote_members: true,
    can_change_info: true,
    can_invite_users: true,
    can_post_stories: true,
    can_edit_stories: true,
    can_delete_stories: true,
    can_post_messages: true,
    can_edit_messages: true,
    can_pin_messages: true,
    can_manage_topics: true
  };
  exports.API_CONSTANTS = {
    DEFAULT_UPDATE_TYPES: bot_js_1.DEFAULT_UPDATE_TYPES,
    ALL_UPDATE_TYPES,
    ALL_CHAT_PERMISSIONS
  };
  Object.freeze(exports.API_CONSTANTS);
});

// node_modules/grammy/out/convenience/inline_query.js
var require_inline_query = __commonJS((exports) => {
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.InlineQueryResultBuilder = undefined;
  function inputMessage(queryTemplate) {
    return {
      ...queryTemplate,
      ...inputMessageMethods(queryTemplate)
    };
  }
  function inputMessageMethods(queryTemplate) {
    return {
      text(message_text, options = {}) {
        const content = {
          message_text,
          ...options
        };
        return { ...queryTemplate, input_message_content: content };
      },
      location(latitude, longitude, options = {}) {
        const content = {
          latitude,
          longitude,
          ...options
        };
        return { ...queryTemplate, input_message_content: content };
      },
      venue(title, latitude, longitude, address, options) {
        const content = {
          title,
          latitude,
          longitude,
          address,
          ...options
        };
        return { ...queryTemplate, input_message_content: content };
      },
      contact(first_name, phone_number, options = {}) {
        const content = {
          first_name,
          phone_number,
          ...options
        };
        return { ...queryTemplate, input_message_content: content };
      },
      invoice(title, description, payload, provider_token, currency, prices, options = {}) {
        const content = {
          title,
          description,
          payload,
          provider_token,
          currency,
          prices,
          ...options
        };
        return { ...queryTemplate, input_message_content: content };
      }
    };
  }
  exports.InlineQueryResultBuilder = {
    article(id, title, options = {}) {
      return inputMessageMethods({ type: "article", id, title, ...options });
    },
    audio(id, title, audio_url, options = {}) {
      return inputMessage({
        type: "audio",
        id,
        title,
        audio_url: typeof audio_url === "string" ? audio_url : audio_url.href,
        ...options
      });
    },
    audioCached(id, audio_file_id, options = {}) {
      return inputMessage({ type: "audio", id, audio_file_id, ...options });
    },
    contact(id, phone_number, first_name, options = {}) {
      return inputMessage({ type: "contact", id, phone_number, first_name, ...options });
    },
    documentPdf(id, title, document_url, options = {}) {
      return inputMessage({
        type: "document",
        mime_type: "application/pdf",
        id,
        title,
        document_url: typeof document_url === "string" ? document_url : document_url.href,
        ...options
      });
    },
    documentZip(id, title, document_url, options = {}) {
      return inputMessage({
        type: "document",
        mime_type: "application/zip",
        id,
        title,
        document_url: typeof document_url === "string" ? document_url : document_url.href,
        ...options
      });
    },
    documentCached(id, title, document_file_id, options = {}) {
      return inputMessage({ type: "document", id, title, document_file_id, ...options });
    },
    game(id, game_short_name, options = {}) {
      return { type: "game", id, game_short_name, ...options };
    },
    gif(id, gif_url, thumbnail_url, options = {}) {
      return inputMessage({
        type: "gif",
        id,
        gif_url: typeof gif_url === "string" ? gif_url : gif_url.href,
        thumbnail_url: typeof thumbnail_url === "string" ? thumbnail_url : thumbnail_url.href,
        ...options
      });
    },
    gifCached(id, gif_file_id, options = {}) {
      return inputMessage({ type: "gif", id, gif_file_id, ...options });
    },
    location(id, title, latitude, longitude, options = {}) {
      return inputMessage({ type: "location", id, title, latitude, longitude, ...options });
    },
    mpeg4gif(id, mpeg4_url, thumbnail_url, options = {}) {
      return inputMessage({
        type: "mpeg4_gif",
        id,
        mpeg4_url: typeof mpeg4_url === "string" ? mpeg4_url : mpeg4_url.href,
        thumbnail_url: typeof thumbnail_url === "string" ? thumbnail_url : thumbnail_url.href,
        ...options
      });
    },
    mpeg4gifCached(id, mpeg4_file_id, options = {}) {
      return inputMessage({ type: "mpeg4_gif", id, mpeg4_file_id, ...options });
    },
    photo(id, photo_url, options = {
      thumbnail_url: typeof photo_url === "string" ? photo_url : photo_url.href
    }) {
      return inputMessage({
        type: "photo",
        id,
        photo_url: typeof photo_url === "string" ? photo_url : photo_url.href,
        ...options
      });
    },
    photoCached(id, photo_file_id, options = {}) {
      return inputMessage({ type: "photo", id, photo_file_id, ...options });
    },
    stickerCached(id, sticker_file_id, options = {}) {
      return inputMessage({ type: "sticker", id, sticker_file_id, ...options });
    },
    venue(id, title, latitude, longitude, address, options = {}) {
      return inputMessage({
        type: "venue",
        id,
        title,
        latitude,
        longitude,
        address,
        ...options
      });
    },
    videoHtml(id, title, video_url, thumbnail_url, options = {}) {
      return inputMessageMethods({
        type: "video",
        mime_type: "text/html",
        id,
        title,
        video_url: typeof video_url === "string" ? video_url : video_url.href,
        thumbnail_url: typeof thumbnail_url === "string" ? thumbnail_url : thumbnail_url.href,
        ...options
      });
    },
    videoMp4(id, title, video_url, thumbnail_url, options = {}) {
      return inputMessage({
        type: "video",
        mime_type: "video/mp4",
        id,
        title,
        video_url: typeof video_url === "string" ? video_url : video_url.href,
        thumbnail_url: typeof thumbnail_url === "string" ? thumbnail_url : thumbnail_url.href,
        ...options
      });
    },
    videoCached(id, title, video_file_id, options = {}) {
      return inputMessage({ type: "video", id, title, video_file_id, ...options });
    },
    voice(id, title, voice_url, options = {}) {
      return inputMessage({
        type: "voice",
        id,
        title,
        voice_url: typeof voice_url === "string" ? voice_url : voice_url.href,
        ...options
      });
    },
    voiceCached(id, title, voice_file_id, options = {}) {
      return inputMessage({ type: "voice", id, title, voice_file_id, ...options });
    }
  };
});

// node_modules/grammy/out/convenience/input_media.js
var require_input_media = __commonJS((exports) => {
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.InputMediaBuilder = undefined;
  exports.InputMediaBuilder = {
    photo(media, options = {}) {
      return { type: "photo", media, ...options };
    },
    video(media, options = {}) {
      return { type: "video", media, ...options };
    },
    animation(media, options = {}) {
      return { type: "animation", media, ...options };
    },
    audio(media, options = {}) {
      return { type: "audio", media, ...options };
    },
    document(media, options = {}) {
      return { type: "document", media, ...options };
    }
  };
});

// node_modules/grammy/out/convenience/keyboard.js
var require_keyboard = __commonJS((exports) => {
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.InlineKeyboard = exports.Keyboard = undefined;

  class Keyboard {
    constructor(keyboard = [[]]) {
      this.keyboard = keyboard;
    }
    add(...buttons) {
      var _a;
      (_a = this.keyboard[this.keyboard.length - 1]) === null || _a === undefined || _a.push(...buttons);
      return this;
    }
    row(...buttons) {
      this.keyboard.push(buttons);
      return this;
    }
    text(text) {
      return this.add(Keyboard.text(text));
    }
    static text(text) {
      return { text };
    }
    requestUsers(text, requestId, options = {}) {
      return this.add(Keyboard.requestUsers(text, requestId, options));
    }
    static requestUsers(text, requestId, options = {}) {
      return { text, request_users: { request_id: requestId, ...options } };
    }
    requestChat(text, requestId, options = {
      chat_is_channel: false
    }) {
      return this.add(Keyboard.requestChat(text, requestId, options));
    }
    static requestChat(text, requestId, options = {
      chat_is_channel: false
    }) {
      return { text, request_chat: { request_id: requestId, ...options } };
    }
    requestContact(text) {
      return this.add(Keyboard.requestContact(text));
    }
    static requestContact(text) {
      return { text, request_contact: true };
    }
    requestLocation(text) {
      return this.add(Keyboard.requestLocation(text));
    }
    static requestLocation(text) {
      return { text, request_location: true };
    }
    requestPoll(text, type) {
      return this.add(Keyboard.requestPoll(text, type));
    }
    static requestPoll(text, type) {
      return { text, request_poll: { type } };
    }
    webApp(text, url) {
      return this.add(Keyboard.webApp(text, url));
    }
    static webApp(text, url) {
      return { text, web_app: { url } };
    }
    persistent(isEnabled = true) {
      this.is_persistent = isEnabled;
      return this;
    }
    selected(isEnabled = true) {
      this.selective = isEnabled;
      return this;
    }
    oneTime(isEnabled = true) {
      this.one_time_keyboard = isEnabled;
      return this;
    }
    resized(isEnabled = true) {
      this.resize_keyboard = isEnabled;
      return this;
    }
    placeholder(value) {
      this.input_field_placeholder = value;
      return this;
    }
    toTransposed() {
      const original = this.keyboard;
      const transposed = transpose(original);
      return this.clone(transposed);
    }
    toFlowed(columns, options = {}) {
      const original = this.keyboard;
      const flowed = reflow(original, columns, options);
      return this.clone(flowed);
    }
    clone(keyboard = this.keyboard) {
      const clone = new Keyboard(keyboard.map((row) => row.slice()));
      clone.is_persistent = this.is_persistent;
      clone.selective = this.selective;
      clone.one_time_keyboard = this.one_time_keyboard;
      clone.resize_keyboard = this.resize_keyboard;
      clone.input_field_placeholder = this.input_field_placeholder;
      return clone;
    }
    append(...sources) {
      for (const source of sources) {
        const keyboard = Keyboard.from(source);
        this.keyboard.push(...keyboard.keyboard.map((row) => row.slice()));
      }
      return this;
    }
    build() {
      return this.keyboard;
    }
    static from(source) {
      if (source instanceof Keyboard)
        return source.clone();
      function toButton(btn) {
        return typeof btn === "string" ? Keyboard.text(btn) : btn;
      }
      return new Keyboard(source.map((row) => row.map(toButton)));
    }
  }
  exports.Keyboard = Keyboard;

  class InlineKeyboard {
    constructor(inline_keyboard = [[]]) {
      this.inline_keyboard = inline_keyboard;
    }
    add(...buttons) {
      var _a;
      (_a = this.inline_keyboard[this.inline_keyboard.length - 1]) === null || _a === undefined || _a.push(...buttons);
      return this;
    }
    row(...buttons) {
      this.inline_keyboard.push(buttons);
      return this;
    }
    url(text, url) {
      return this.add(InlineKeyboard.url(text, url));
    }
    static url(text, url) {
      return { text, url };
    }
    text(text, data = text) {
      return this.add(InlineKeyboard.text(text, data));
    }
    static text(text, data = text) {
      return { text, callback_data: data };
    }
    webApp(text, url) {
      return this.add(InlineKeyboard.webApp(text, url));
    }
    static webApp(text, url) {
      return { text, web_app: typeof url === "string" ? { url } : url };
    }
    login(text, loginUrl) {
      return this.add(InlineKeyboard.login(text, loginUrl));
    }
    static login(text, loginUrl) {
      return {
        text,
        login_url: typeof loginUrl === "string" ? { url: loginUrl } : loginUrl
      };
    }
    switchInline(text, query = "") {
      return this.add(InlineKeyboard.switchInline(text, query));
    }
    static switchInline(text, query = "") {
      return { text, switch_inline_query: query };
    }
    switchInlineCurrent(text, query = "") {
      return this.add(InlineKeyboard.switchInlineCurrent(text, query));
    }
    static switchInlineCurrent(text, query = "") {
      return { text, switch_inline_query_current_chat: query };
    }
    switchInlineChosen(text, query = {}) {
      return this.add(InlineKeyboard.switchInlineChosen(text, query));
    }
    static switchInlineChosen(text, query = {}) {
      return { text, switch_inline_query_chosen_chat: query };
    }
    copyText(text, copyText) {
      return this.add(InlineKeyboard.copyText(text, copyText));
    }
    static copyText(text, copyText) {
      return {
        text,
        copy_text: typeof copyText === "string" ? { text: copyText } : copyText
      };
    }
    game(text) {
      return this.add(InlineKeyboard.game(text));
    }
    static game(text) {
      return { text, callback_game: {} };
    }
    pay(text) {
      return this.add(InlineKeyboard.pay(text));
    }
    static pay(text) {
      return { text, pay: true };
    }
    toTransposed() {
      const original = this.inline_keyboard;
      const transposed = transpose(original);
      return new InlineKeyboard(transposed);
    }
    toFlowed(columns, options = {}) {
      const original = this.inline_keyboard;
      const flowed = reflow(original, columns, options);
      return new InlineKeyboard(flowed);
    }
    clone() {
      return new InlineKeyboard(this.inline_keyboard.map((row) => row.slice()));
    }
    append(...sources) {
      for (const source of sources) {
        const keyboard = InlineKeyboard.from(source);
        this.inline_keyboard.push(...keyboard.inline_keyboard.map((row) => row.slice()));
      }
      return this;
    }
    static from(source) {
      if (source instanceof InlineKeyboard)
        return source.clone();
      return new InlineKeyboard(source.map((row) => row.slice()));
    }
  }
  exports.InlineKeyboard = InlineKeyboard;
  function transpose(grid) {
    var _a;
    const transposed = [];
    for (let i = 0;i < grid.length; i++) {
      const row = grid[i];
      for (let j = 0;j < row.length; j++) {
        const button = row[j];
        ((_a = transposed[j]) !== null && _a !== undefined ? _a : transposed[j] = []).push(button);
      }
    }
    return transposed;
  }
  function reflow(grid, columns, { fillLastRow = false }) {
    var _a;
    let first = columns;
    if (fillLastRow) {
      const buttonCount = grid.map((row) => row.length).reduce((a, b) => a + b, 0);
      first = buttonCount % columns;
    }
    const reflowed = [];
    for (const row of grid) {
      for (const button of row) {
        const at = Math.max(0, reflowed.length - 1);
        const max = at === 0 ? first : columns;
        let next = (_a = reflowed[at]) !== null && _a !== undefined ? _a : reflowed[at] = [];
        if (next.length === max) {
          next = [];
          reflowed.push(next);
        }
        next.push(button);
      }
    }
    return reflowed;
  }
});

// node_modules/grammy/out/convenience/session.js
var require_session = __commonJS((exports) => {
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.MemorySessionStorage = undefined;
  exports.session = session;
  exports.lazySession = lazySession;
  exports.enhanceStorage = enhanceStorage;
  var platform_node_js_1 = require_platform_node();
  var debug = (0, platform_node_js_1.debug)("grammy:session");
  function session(options = {}) {
    return options.type === "multi" ? strictMultiSession(options) : strictSingleSession(options);
  }
  function strictSingleSession(options) {
    const { initial, storage, getSessionKey, custom } = fillDefaults(options);
    return async (ctx, next) => {
      const propSession = new PropertySession(storage, ctx, "session", initial);
      const key = await getSessionKey(ctx);
      await propSession.init(key, { custom, lazy: false });
      await next();
      await propSession.finish();
    };
  }
  function strictMultiSession(options) {
    const props = Object.keys(options).filter((k) => k !== "type");
    const defaults = Object.fromEntries(props.map((prop) => [prop, fillDefaults(options[prop])]));
    return async (ctx, next) => {
      ctx.session = {};
      const propSessions = await Promise.all(props.map(async (prop) => {
        const { initial, storage, getSessionKey, custom } = defaults[prop];
        const s = new PropertySession(storage, ctx.session, prop, initial);
        const key = await getSessionKey(ctx);
        await s.init(key, { custom, lazy: false });
        return s;
      }));
      await next();
      if (ctx.session == null)
        propSessions.forEach((s) => s.delete());
      await Promise.all(propSessions.map((s) => s.finish()));
    };
  }
  function lazySession(options = {}) {
    if (options.type !== undefined && options.type !== "single") {
      throw new Error("Cannot use lazy multi sessions!");
    }
    const { initial, storage, getSessionKey, custom } = fillDefaults(options);
    return async (ctx, next) => {
      const propSession = new PropertySession(storage, ctx, "session", initial);
      const key = await getSessionKey(ctx);
      await propSession.init(key, { custom, lazy: true });
      await next();
      await propSession.finish();
    };
  }

  class PropertySession {
    constructor(storage, obj, prop, initial) {
      this.storage = storage;
      this.obj = obj;
      this.prop = prop;
      this.initial = initial;
      this.fetching = false;
      this.read = false;
      this.wrote = false;
    }
    load() {
      if (this.key === undefined) {
        return;
      }
      if (this.wrote) {
        return;
      }
      if (this.promise === undefined) {
        this.fetching = true;
        this.promise = Promise.resolve(this.storage.read(this.key)).then((val) => {
          var _a;
          this.fetching = false;
          if (this.wrote) {
            return this.value;
          }
          if (val !== undefined) {
            this.value = val;
            return val;
          }
          val = (_a = this.initial) === null || _a === undefined ? undefined : _a.call(this);
          if (val !== undefined) {
            this.wrote = true;
            this.value = val;
          }
          return val;
        });
      }
      return this.promise;
    }
    async init(key, opts) {
      this.key = key;
      if (!opts.lazy)
        await this.load();
      Object.defineProperty(this.obj, this.prop, {
        enumerable: true,
        get: () => {
          if (key === undefined) {
            const msg = undef("access", opts);
            throw new Error(msg);
          }
          this.read = true;
          if (!opts.lazy || this.wrote)
            return this.value;
          this.load();
          return this.fetching ? this.promise : this.value;
        },
        set: (v) => {
          if (key === undefined) {
            const msg = undef("assign", opts);
            throw new Error(msg);
          }
          this.wrote = true;
          this.fetching = false;
          this.value = v;
        }
      });
    }
    delete() {
      Object.assign(this.obj, { [this.prop]: undefined });
    }
    async finish() {
      if (this.key !== undefined) {
        if (this.read)
          await this.load();
        if (this.read || this.wrote) {
          const value = await this.value;
          if (value == null)
            await this.storage.delete(this.key);
          else
            await this.storage.write(this.key, value);
        }
      }
    }
  }
  function fillDefaults(opts = {}) {
    let { prefix = "", getSessionKey = defaultGetSessionKey, initial, storage } = opts;
    if (storage == null) {
      debug("Storing session data in memory, all data will be lost when the bot restarts.");
      storage = new MemorySessionStorage;
    }
    const custom = getSessionKey !== defaultGetSessionKey;
    return {
      initial,
      storage,
      getSessionKey: async (ctx) => {
        const key = await getSessionKey(ctx);
        return key === undefined ? undefined : prefix + key;
      },
      custom
    };
  }
  function defaultGetSessionKey(ctx) {
    var _a;
    return (_a = ctx.chatId) === null || _a === undefined ? undefined : _a.toString();
  }
  function undef(op, opts) {
    const { lazy = false, custom } = opts;
    const reason = custom ? "the custom `getSessionKey` function returned undefined for this update" : "this update does not belong to a chat, so the session key is undefined";
    return `Cannot ${op} ${lazy ? "lazy " : ""}session data because ${reason}!`;
  }
  function isEnhance(value) {
    return value === undefined || typeof value === "object" && value !== null && "__d" in value;
  }
  function enhanceStorage(options) {
    let { storage, millisecondsToLive, migrations } = options;
    storage = compatStorage(storage);
    if (millisecondsToLive !== undefined) {
      storage = timeoutStorage(storage, millisecondsToLive);
    }
    if (migrations !== undefined) {
      storage = migrationStorage(storage, migrations);
    }
    return wrapStorage(storage);
  }
  function compatStorage(storage) {
    return {
      read: async (k) => {
        const v = await storage.read(k);
        return isEnhance(v) ? v : { __d: v };
      },
      write: (k, v) => storage.write(k, v),
      delete: (k) => storage.delete(k)
    };
  }
  function timeoutStorage(storage, millisecondsToLive) {
    const ttlStorage = {
      read: async (k) => {
        const value = await storage.read(k);
        if (value === undefined)
          return;
        if (value.e === undefined) {
          await ttlStorage.write(k, value);
          return value;
        }
        if (value.e < Date.now()) {
          await ttlStorage.delete(k);
          return;
        }
        return value;
      },
      write: async (k, v) => {
        v.e = addExpiryDate(v, millisecondsToLive).expires;
        await storage.write(k, v);
      },
      delete: (k) => storage.delete(k)
    };
    return ttlStorage;
  }
  function migrationStorage(storage, migrations) {
    const versions = Object.keys(migrations).map((v) => parseInt(v)).sort((a, b) => a - b);
    const count = versions.length;
    if (count === 0)
      throw new Error("No migrations given!");
    const earliest = versions[0];
    const last = count - 1;
    const latest = versions[last];
    const index = new Map;
    versions.forEach((v, i) => index.set(v, i));
    function nextAfter(current) {
      let i = last;
      while (current <= versions[i])
        i--;
      return i;
    }
    return {
      read: async (k) => {
        var _a;
        const val = await storage.read(k);
        if (val === undefined)
          return val;
        let { __d: value, v: current = earliest - 1 } = val;
        let i = 1 + ((_a = index.get(current)) !== null && _a !== undefined ? _a : nextAfter(current));
        for (;i < count; i++)
          value = migrations[versions[i]](value);
        return { ...val, v: latest, __d: value };
      },
      write: (k, v) => storage.write(k, { v: latest, ...v }),
      delete: (k) => storage.delete(k)
    };
  }
  function wrapStorage(storage) {
    return {
      read: (k) => Promise.resolve(storage.read(k)).then((v) => v === null || v === undefined ? undefined : v.__d),
      write: (k, v) => storage.write(k, { __d: v }),
      delete: (k) => storage.delete(k)
    };
  }

  class MemorySessionStorage {
    constructor(timeToLive) {
      this.timeToLive = timeToLive;
      this.storage = new Map;
    }
    read(key) {
      const value = this.storage.get(key);
      if (value === undefined)
        return;
      if (value.expires !== undefined && value.expires < Date.now()) {
        this.delete(key);
        return;
      }
      return value.session;
    }
    readAll() {
      return this.readAllValues();
    }
    readAllKeys() {
      return Array.from(this.storage.keys());
    }
    readAllValues() {
      return Array.from(this.storage.keys()).map((key) => this.read(key)).filter((value) => value !== undefined);
    }
    readAllEntries() {
      return Array.from(this.storage.keys()).map((key) => [key, this.read(key)]).filter((pair) => pair[1] !== undefined);
    }
    has(key) {
      return this.storage.has(key);
    }
    write(key, value) {
      this.storage.set(key, addExpiryDate(value, this.timeToLive));
    }
    delete(key) {
      this.storage.delete(key);
    }
  }
  exports.MemorySessionStorage = MemorySessionStorage;
  function addExpiryDate(value, ttl) {
    if (ttl !== undefined && ttl < Infinity) {
      const now = Date.now();
      return { session: value, expires: now + ttl };
    } else {
      return { session: value };
    }
  }
});

// node_modules/grammy/out/convenience/frameworks.js
var require_frameworks = __commonJS((exports) => {
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.adapters = undefined;
  var SECRET_HEADER = "X-Telegram-Bot-Api-Secret-Token";
  var SECRET_HEADER_LOWERCASE = SECRET_HEADER.toLowerCase();
  var WRONG_TOKEN_ERROR = "secret token is wrong";
  var ok = () => new Response(null, { status: 200 });
  var okJson = (json) => new Response(json, {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
  var unauthorized = () => new Response('"unauthorized"', {
    status: 401,
    statusText: WRONG_TOKEN_ERROR
  });
  var awsLambda = (event, _context, callback) => {
    var _a;
    return {
      update: JSON.parse((_a = event.body) !== null && _a !== undefined ? _a : "{}"),
      header: event.headers[SECRET_HEADER],
      end: () => callback(null, { statusCode: 200 }),
      respond: (json) => callback(null, {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: json
      }),
      unauthorized: () => callback(null, { statusCode: 401 })
    };
  };
  var awsLambdaAsync = (event, _context) => {
    var _a;
    let resolveResponse;
    return {
      update: JSON.parse((_a = event.body) !== null && _a !== undefined ? _a : "{}"),
      header: event.headers[SECRET_HEADER],
      end: () => resolveResponse({ statusCode: 200 }),
      respond: (json) => resolveResponse({
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: json
      }),
      unauthorized: () => resolveResponse({ statusCode: 401 }),
      handlerReturn: new Promise((resolve) => {
        resolveResponse = resolve;
      })
    };
  };
  var azure = (request, context) => {
    var _a, _b;
    return {
      update: Promise.resolve(request.body),
      header: (_b = (_a = context.res) === null || _a === undefined ? undefined : _a.headers) === null || _b === undefined ? undefined : _b[SECRET_HEADER],
      end: () => context.res = {
        status: 200,
        body: ""
      },
      respond: (json) => {
        var _a2, _b2, _c, _d;
        (_b2 = (_a2 = context.res) === null || _a2 === undefined ? undefined : _a2.set) === null || _b2 === undefined || _b2.call(_a2, "Content-Type", "application/json");
        (_d = (_c = context.res) === null || _c === undefined ? undefined : _c.send) === null || _d === undefined || _d.call(_c, json);
      },
      unauthorized: () => {
        var _a2, _b2;
        (_b2 = (_a2 = context.res) === null || _a2 === undefined ? undefined : _a2.send) === null || _b2 === undefined || _b2.call(_a2, 401, WRONG_TOKEN_ERROR);
      }
    };
  };
  var bun = (request) => {
    let resolveResponse;
    return {
      update: request.json(),
      header: request.headers.get(SECRET_HEADER) || undefined,
      end: () => {
        resolveResponse(ok());
      },
      respond: (json) => {
        resolveResponse(okJson(json));
      },
      unauthorized: () => {
        resolveResponse(unauthorized());
      },
      handlerReturn: new Promise((resolve) => {
        resolveResponse = resolve;
      })
    };
  };
  var cloudflare = (event) => {
    let resolveResponse;
    event.respondWith(new Promise((resolve) => {
      resolveResponse = resolve;
    }));
    return {
      update: event.request.json(),
      header: event.request.headers.get(SECRET_HEADER) || undefined,
      end: () => {
        resolveResponse(ok());
      },
      respond: (json) => {
        resolveResponse(okJson(json));
      },
      unauthorized: () => {
        resolveResponse(unauthorized());
      }
    };
  };
  var cloudflareModule = (request) => {
    let resolveResponse;
    return {
      update: request.json(),
      header: request.headers.get(SECRET_HEADER) || undefined,
      end: () => {
        resolveResponse(ok());
      },
      respond: (json) => {
        resolveResponse(okJson(json));
      },
      unauthorized: () => {
        resolveResponse(unauthorized());
      },
      handlerReturn: new Promise((resolve) => {
        resolveResponse = resolve;
      })
    };
  };
  var express = (req, res) => ({
    update: Promise.resolve(req.body),
    header: req.header(SECRET_HEADER),
    end: () => res.end(),
    respond: (json) => {
      res.set("Content-Type", "application/json");
      res.send(json);
    },
    unauthorized: () => {
      res.status(401).send(WRONG_TOKEN_ERROR);
    }
  });
  var fastify = (request, reply) => ({
    update: Promise.resolve(request.body),
    header: request.headers[SECRET_HEADER_LOWERCASE],
    end: () => reply.status(200).send(),
    respond: (json) => reply.headers({ "Content-Type": "application/json" }).send(json),
    unauthorized: () => reply.code(401).send(WRONG_TOKEN_ERROR)
  });
  var hono = (c) => {
    let resolveResponse;
    return {
      update: c.req.json(),
      header: c.req.header(SECRET_HEADER),
      end: () => {
        resolveResponse(c.body(""));
      },
      respond: (json) => {
        resolveResponse(c.json(json));
      },
      unauthorized: () => {
        c.status(401);
        resolveResponse(c.body(""));
      },
      handlerReturn: new Promise((resolve) => {
        resolveResponse = resolve;
      })
    };
  };
  var http = (req, res) => {
    const secretHeaderFromRequest = req.headers[SECRET_HEADER_LOWERCASE];
    return {
      update: new Promise((resolve, reject) => {
        const chunks = [];
        req.on("data", (chunk) => chunks.push(chunk)).once("end", () => {
          const raw = Buffer.concat(chunks).toString("utf-8");
          resolve(JSON.parse(raw));
        }).once("error", reject);
      }),
      header: Array.isArray(secretHeaderFromRequest) ? secretHeaderFromRequest[0] : secretHeaderFromRequest,
      end: () => res.end(),
      respond: (json) => res.writeHead(200, { "Content-Type": "application/json" }).end(json),
      unauthorized: () => res.writeHead(401).end(WRONG_TOKEN_ERROR)
    };
  };
  var koa = (ctx) => ({
    update: Promise.resolve(ctx.request.body),
    header: ctx.get(SECRET_HEADER) || undefined,
    end: () => {
      ctx.body = "";
    },
    respond: (json) => {
      ctx.set("Content-Type", "application/json");
      ctx.response.body = json;
    },
    unauthorized: () => {
      ctx.status = 401;
    }
  });
  var nextJs = (request, response) => ({
    update: Promise.resolve(request.body),
    header: request.headers[SECRET_HEADER_LOWERCASE],
    end: () => response.end(),
    respond: (json) => response.status(200).json(json),
    unauthorized: () => response.status(401).send(WRONG_TOKEN_ERROR)
  });
  var nhttp = (rev) => ({
    update: Promise.resolve(rev.body),
    header: rev.headers.get(SECRET_HEADER) || undefined,
    end: () => rev.response.sendStatus(200),
    respond: (json) => rev.response.status(200).send(json),
    unauthorized: () => rev.response.status(401).send(WRONG_TOKEN_ERROR)
  });
  var oak = (ctx) => ({
    update: ctx.request.body.json(),
    header: ctx.request.headers.get(SECRET_HEADER) || undefined,
    end: () => {
      ctx.response.status = 200;
    },
    respond: (json) => {
      ctx.response.type = "json";
      ctx.response.body = json;
    },
    unauthorized: () => {
      ctx.response.status = 401;
    }
  });
  var serveHttp = (requestEvent) => ({
    update: requestEvent.request.json(),
    header: requestEvent.request.headers.get(SECRET_HEADER) || undefined,
    end: () => requestEvent.respondWith(ok()),
    respond: (json) => requestEvent.respondWith(okJson(json)),
    unauthorized: () => requestEvent.respondWith(unauthorized())
  });
  var stdHttp = (req) => {
    let resolveResponse;
    return {
      update: req.json(),
      header: req.headers.get(SECRET_HEADER) || undefined,
      end: () => {
        if (resolveResponse)
          resolveResponse(ok());
      },
      respond: (json) => {
        if (resolveResponse)
          resolveResponse(okJson(json));
      },
      unauthorized: () => {
        if (resolveResponse)
          resolveResponse(unauthorized());
      },
      handlerReturn: new Promise((resolve) => {
        resolveResponse = resolve;
      })
    };
  };
  var sveltekit = ({ request }) => {
    let resolveResponse;
    return {
      update: Promise.resolve(request.json()),
      header: request.headers.get(SECRET_HEADER) || undefined,
      end: () => {
        if (resolveResponse)
          resolveResponse(ok());
      },
      respond: (json) => {
        if (resolveResponse)
          resolveResponse(okJson(json));
      },
      unauthorized: () => {
        if (resolveResponse)
          resolveResponse(unauthorized());
      },
      handlerReturn: new Promise((resolve) => {
        resolveResponse = resolve;
      })
    };
  };
  var worktop = (req, res) => {
    var _a;
    return {
      update: Promise.resolve(req.json()),
      header: (_a = req.headers.get(SECRET_HEADER)) !== null && _a !== undefined ? _a : undefined,
      end: () => res.end(null),
      respond: (json) => res.send(200, json),
      unauthorized: () => res.send(401, WRONG_TOKEN_ERROR)
    };
  };
  exports.adapters = {
    "aws-lambda": awsLambda,
    "aws-lambda-async": awsLambdaAsync,
    azure,
    bun,
    cloudflare,
    "cloudflare-mod": cloudflareModule,
    express,
    fastify,
    hono,
    http,
    https: http,
    koa,
    "next-js": nextJs,
    nhttp,
    oak,
    serveHttp,
    "std/http": stdHttp,
    sveltekit,
    worktop
  };
});

// node_modules/grammy/out/convenience/webhook.js
var require_webhook = __commonJS((exports) => {
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.webhookCallback = webhookCallback;
  var platform_node_js_1 = require_platform_node();
  var frameworks_js_1 = require_frameworks();
  var debugErr = (0, platform_node_js_1.debug)("grammy:error");
  var callbackAdapter = (update, callback, header, unauthorized = () => callback('"unauthorized"')) => ({
    update: Promise.resolve(update),
    respond: callback,
    header,
    unauthorized
  });
  var adapters = { ...frameworks_js_1.adapters, callback: callbackAdapter };
  function webhookCallback(bot, adapter = platform_node_js_1.defaultAdapter, onTimeout, timeoutMilliseconds, secretToken) {
    if (bot.isRunning()) {
      throw new Error("Bot is already running via long polling, the webhook setup won't receive any updates!");
    } else {
      bot.start = () => {
        throw new Error("You already started the bot via webhooks, calling `bot.start()` starts the bot with long polling and this will prevent your webhook setup from receiving any updates!");
      };
    }
    const { onTimeout: timeout = "throw", timeoutMilliseconds: ms = 1e4, secretToken: token } = typeof onTimeout === "object" ? onTimeout : { onTimeout, timeoutMilliseconds, secretToken };
    let initialized = false;
    const server = typeof adapter === "string" ? adapters[adapter] : adapter;
    return async (...args) => {
      const { update, respond, unauthorized, end, handlerReturn, header } = server(...args);
      if (!initialized) {
        await bot.init();
        initialized = true;
      }
      if (header !== token) {
        await unauthorized();
        console.log(handlerReturn);
        return handlerReturn;
      }
      let usedWebhookReply = false;
      const webhookReplyEnvelope = {
        async send(json) {
          usedWebhookReply = true;
          await respond(json);
        }
      };
      await timeoutIfNecessary(bot.handleUpdate(await update, webhookReplyEnvelope), typeof timeout === "function" ? () => timeout(...args) : timeout, ms);
      if (!usedWebhookReply)
        end === null || end === undefined || end();
      return handlerReturn;
    };
  }
  function timeoutIfNecessary(task, onTimeout, timeout) {
    if (timeout === Infinity)
      return task;
    return new Promise((resolve, reject) => {
      const handle = setTimeout(() => {
        debugErr(`Request timed out after ${timeout} ms`);
        if (onTimeout === "throw") {
          reject(new Error(`Request timed out after ${timeout} ms`));
        } else {
          if (typeof onTimeout === "function")
            onTimeout();
          resolve();
        }
        const now = Date.now();
        task.finally(() => {
          const diff = Date.now() - now;
          debugErr(`Request completed ${diff} ms after timeout!`);
        });
      }, timeout);
      task.then(resolve).catch(reject).finally(() => clearTimeout(handle));
    });
  }
});

// node_modules/grammy/out/mod.js
var require_mod = __commonJS((exports) => {
  var __createBinding = exports && exports.__createBinding || (Object.create ? function(o, m, k, k2) {
    if (k2 === undefined)
      k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() {
        return m[k];
      } };
    }
    Object.defineProperty(o, k2, desc);
  } : function(o, m, k, k2) {
    if (k2 === undefined)
      k2 = k;
    o[k2] = m[k];
  });
  var __exportStar = exports && exports.__exportStar || function(m, exports2) {
    for (var p in m)
      if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports2, p))
        __createBinding(exports2, m, p);
  };
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.HttpError = exports.GrammyError = exports.Api = exports.matchFilter = exports.Composer = exports.Context = exports.InputFile = exports.BotError = exports.Bot = undefined;
  var bot_js_1 = require_bot();
  Object.defineProperty(exports, "Bot", { enumerable: true, get: function() {
    return bot_js_1.Bot;
  } });
  Object.defineProperty(exports, "BotError", { enumerable: true, get: function() {
    return bot_js_1.BotError;
  } });
  var types_js_1 = require_types();
  Object.defineProperty(exports, "InputFile", { enumerable: true, get: function() {
    return types_js_1.InputFile;
  } });
  var context_js_1 = require_context();
  Object.defineProperty(exports, "Context", { enumerable: true, get: function() {
    return context_js_1.Context;
  } });
  __exportStar(require_constants(), exports);
  __exportStar(require_inline_query(), exports);
  __exportStar(require_input_media(), exports);
  __exportStar(require_keyboard(), exports);
  __exportStar(require_session(), exports);
  __exportStar(require_webhook(), exports);
  var composer_js_1 = require_composer();
  Object.defineProperty(exports, "Composer", { enumerable: true, get: function() {
    return composer_js_1.Composer;
  } });
  var filter_js_1 = require_filter();
  Object.defineProperty(exports, "matchFilter", { enumerable: true, get: function() {
    return filter_js_1.matchFilter;
  } });
  var api_js_1 = require_api();
  Object.defineProperty(exports, "Api", { enumerable: true, get: function() {
    return api_js_1.Api;
  } });
  var error_js_1 = require_error();
  Object.defineProperty(exports, "GrammyError", { enumerable: true, get: function() {
    return error_js_1.GrammyError;
  } });
  Object.defineProperty(exports, "HttpError", { enumerable: true, get: function() {
    return error_js_1.HttpError;
  } });
});

// node_modules/dargs/index.js
var require_dargs = __commonJS((exports, module) => {
  var match = (array, value) => array.some((x) => x instanceof RegExp ? x.test(value) : x === value);
  var dargs = (object, options) => {
    const arguments_ = [];
    let extraArguments = [];
    let separatedArguments = [];
    options = {
      useEquals: true,
      shortFlag: true,
      ...options
    };
    const makeArguments = (key, value) => {
      const prefix = options.shortFlag && key.length === 1 ? "-" : "--";
      const theKey = options.allowCamelCase ? key : key.replace(/[A-Z]/g, "-$&").toLowerCase();
      key = prefix + theKey;
      if (options.useEquals) {
        arguments_.push(key + (value ? `=${value}` : ""));
      } else {
        arguments_.push(key);
        if (value) {
          arguments_.push(value);
        }
      }
    };
    const makeAliasArg = (key, value) => {
      arguments_.push(`-${key}`);
      if (value) {
        arguments_.push(value);
      }
    };
    for (let [key, value] of Object.entries(object)) {
      let pushArguments = makeArguments;
      if (Array.isArray(options.excludes) && match(options.excludes, key)) {
        continue;
      }
      if (Array.isArray(options.includes) && !match(options.includes, key)) {
        continue;
      }
      if (typeof options.aliases === "object" && options.aliases[key]) {
        key = options.aliases[key];
        pushArguments = makeAliasArg;
      }
      if (key === "--") {
        if (!Array.isArray(value)) {
          throw new TypeError(`Expected key \`--\` to be Array, got ${typeof value}`);
        }
        separatedArguments = value;
        continue;
      }
      if (key === "_") {
        if (!Array.isArray(value)) {
          throw new TypeError(`Expected key \`_\` to be Array, got ${typeof value}`);
        }
        extraArguments = value;
        continue;
      }
      if (value === true) {
        pushArguments(key, "");
      }
      if (value === false && !options.ignoreFalse) {
        pushArguments(`no-${key}`);
      }
      if (typeof value === "string") {
        pushArguments(key, value);
      }
      if (typeof value === "number" && !Number.isNaN(value)) {
        pushArguments(key, String(value));
      }
      if (Array.isArray(value)) {
        for (const arrayValue of value) {
          pushArguments(key, arrayValue);
        }
      }
    }
    for (const argument of extraArguments) {
      arguments_.push(String(argument));
    }
    if (separatedArguments.length > 0) {
      arguments_.push("--");
    }
    for (const argument of separatedArguments) {
      arguments_.push(String(argument));
    }
    return arguments_;
  };
  module.exports = dargs;
});

// node_modules/tinyspawn/src/index.js
var require_src2 = __commonJS((exports, module) => {
  var { spawn } = __require("child_process");
  var { EOL } = __require("os");
  var EE_PROPS = Object.getOwnPropertyNames(__require("events").EventEmitter.prototype).filter((name) => !name.startsWith("_")).concat(["kill", "ref", "unref"]);
  var eos = (stream, listener, buffer = []) => stream[listener] ? stream[listener].on("data", (data) => buffer.push(data)) && buffer : buffer;
  var createChildProcessError = ({ cmd, cmdArgs, childProcess }) => {
    const command = `${cmd} ${cmdArgs.join(" ")}`;
    let message = `The command spawned as:${EOL}${EOL}`;
    message += `  \`${command}\`${EOL}${EOL}`;
    message += `exited with:${EOL}${EOL}`;
    message += `  \`{ signal: '${childProcess.signalCode}', code: ${childProcess.exitCode} }\` ${EOL}${EOL}`;
    message += `with the following trace:${EOL}`;
    const error = new Error(message);
    error.command = command;
    error.name = "ChildProcessError";
    Object.keys(childProcess).filter((key) => !key.startsWith("_") && !["stdio", "stdin"].includes(key)).forEach((key) => {
      error[key] = childProcess[key];
    });
    return error;
  };
  var clean = (str) => str.trim().replace(/\n$/, "");
  var parse = (buffer, { json } = {}) => (encoding, start, end) => {
    const data = clean(Buffer.concat(buffer).toString(encoding, start, end));
    return json ? JSON.parse(data) : data;
  };
  var extend = (defaults) => (input, args, options) => {
    if (!(args instanceof Array)) {
      options = args;
      args = [];
    }
    const [cmd, ...cmdArgs] = input.split(" ").concat(args).filter(Boolean);
    let childProcess;
    const promise = new Promise((resolve, reject) => {
      const opts = { ...defaults, ...options };
      childProcess = spawn(cmd, cmdArgs, opts);
      const stdout = eos(childProcess, "stdout");
      const stderr = eos(childProcess, "stderr");
      childProcess.on("error", reject).on("exit", (exitCode) => {
        Object.defineProperty(childProcess, "stdout", {
          get: parse(stdout, opts)
        });
        Object.defineProperty(childProcess, "stderr", { get: parse(stderr) });
        return exitCode === 0 ? resolve(childProcess) : reject(createChildProcessError({ cmd, cmdArgs, childProcess }));
      });
    });
    const subprocess = Object.assign(promise, childProcess);
    if (childProcess) {
      EE_PROPS.forEach((name) => subprocess[name] = childProcess[name].bind(childProcess));
    }
    return subprocess;
  };
  var $ = extend();
  $.extend = extend;
  $.json = $.extend({ json: true });
  module.exports = $;
});

// node_modules/is-unix/index.js
var require_is_unix = __commonJS((exports, module) => {
  module.exports = (platform = "") => {
    platform = platform.toLowerCase();
    return [
      "aix",
      "android",
      "darwin",
      "freebsd",
      "linux",
      "openbsd",
      "sunos"
    ].indexOf(platform) !== -1;
  };
});

// node_modules/youtube-dl-exec/src/constants.js
var require_constants2 = __commonJS((exports, module) => {
  var __dirname = "/Users/arthurn/Documents/Projects/youtube2rss/node_modules/youtube-dl-exec/src";
  var isUnix = require_is_unix();
  var path = __require("path");
  var PLATFORM_WIN = "win32";
  var PLATFORM_UNIX = "unix";
  function get(key) {
    if (!key)
      return;
    return process.env[key] ?? process.env[`npm_config_${key.toLowerCase()}`] ?? process.env[`npm_config_${key.toUpperCase()}`];
  }
  var YOUTUBE_DL_HOST = get("YOUTUBE_DL_HOST") ?? "https://api.github.com/repos/yt-dlp/yt-dlp/releases/latest";
  var YOUTUBE_DL_DIR = get("YOUTUBE_DL_DIR") ?? path.join(__dirname, "..", "bin");
  var YOUTUBE_DL_PLATFORM = get("YOUTUBE_DL_PLATFORM") ?? isUnix(process.platform) ? PLATFORM_UNIX : PLATFORM_WIN;
  var YOUTUBE_DL_FILENAME = get("YOUTUBE_DL_FILENAME") || "yt-dlp";
  var YOUTUBE_DL_FILE = !YOUTUBE_DL_FILENAME.endsWith(".exe") && YOUTUBE_DL_PLATFORM === "win32" ? `${YOUTUBE_DL_FILENAME}.exe` : YOUTUBE_DL_FILENAME;
  var YOUTUBE_DL_PATH = path.join(YOUTUBE_DL_DIR, YOUTUBE_DL_FILE);
  var YOUTUBE_DL_SKIP_DOWNLOAD = get("YOUTUBE_DL_SKIP_DOWNLOAD");
  module.exports = {
    YOUTUBE_DL_DIR,
    YOUTUBE_DL_FILE,
    YOUTUBE_DL_FILENAME,
    YOUTUBE_DL_HOST,
    YOUTUBE_DL_PATH,
    YOUTUBE_DL_PLATFORM,
    YOUTUBE_DL_SKIP_DOWNLOAD
  };
});

// node_modules/youtube-dl-exec/src/index.js
var require_src3 = __commonJS((exports, module) => {
  var dargs = require_dargs();
  var $ = require_src2();
  var constants = require_constants2();
  var args = (flags = {}) => dargs(flags, { useEquals: false }).filter(Boolean);
  var isJSON = (str = "") => str.startsWith("{");
  var parse = ({ stdout, stderr, ...details }) => {
    if (details.exitCode === 0) {
      return isJSON(stdout) ? JSON.parse(stdout) : stdout;
    }
    throw Object.assign(new Error(stderr), { stderr, stdout }, details);
  };
  var create = (binaryPath) => {
    const fn = (...args2) => fn.exec(...args2).then(parse).catch(parse);
    fn.exec = (url, flags, opts) => $(binaryPath, [url].concat(args(flags)), opts);
    return fn;
  };
  var defaultInstance = create(constants.YOUTUBE_DL_PATH);
  module.exports = defaultInstance;
  module.exports.youtubeDl = defaultInstance;
  module.exports.create = create;
  module.exports.args = args;
  module.exports.isJSON = isJSON;
  module.exports.constants = constants;
});

// node_modules/mime-db/db.json
var require_db = __commonJS((exports, module) => {
  module.exports = {
    "application/1d-interleaved-parityfec": {
      source: "iana"
    },
    "application/3gpdash-qoe-report+xml": {
      source: "iana"
    },
    "application/3gpp-ims+xml": {
      source: "iana"
    },
    "application/a2l": {
      source: "iana"
    },
    "application/activemessage": {
      source: "iana"
    },
    "application/alto-costmap+json": {
      source: "iana",
      compressible: true
    },
    "application/alto-costmapfilter+json": {
      source: "iana",
      compressible: true
    },
    "application/alto-directory+json": {
      source: "iana",
      compressible: true
    },
    "application/alto-endpointcost+json": {
      source: "iana",
      compressible: true
    },
    "application/alto-endpointcostparams+json": {
      source: "iana",
      compressible: true
    },
    "application/alto-endpointprop+json": {
      source: "iana",
      compressible: true
    },
    "application/alto-endpointpropparams+json": {
      source: "iana",
      compressible: true
    },
    "application/alto-error+json": {
      source: "iana",
      compressible: true
    },
    "application/alto-networkmap+json": {
      source: "iana",
      compressible: true
    },
    "application/alto-networkmapfilter+json": {
      source: "iana",
      compressible: true
    },
    "application/aml": {
      source: "iana"
    },
    "application/andrew-inset": {
      source: "iana",
      extensions: ["ez"]
    },
    "application/applefile": {
      source: "iana"
    },
    "application/applixware": {
      source: "apache",
      extensions: ["aw"]
    },
    "application/atf": {
      source: "iana"
    },
    "application/atfx": {
      source: "iana"
    },
    "application/atom+xml": {
      source: "iana",
      compressible: true,
      extensions: ["atom"]
    },
    "application/atomcat+xml": {
      source: "iana",
      extensions: ["atomcat"]
    },
    "application/atomdeleted+xml": {
      source: "iana"
    },
    "application/atomicmail": {
      source: "iana"
    },
    "application/atomsvc+xml": {
      source: "iana",
      extensions: ["atomsvc"]
    },
    "application/atxml": {
      source: "iana"
    },
    "application/auth-policy+xml": {
      source: "iana"
    },
    "application/bacnet-xdd+zip": {
      source: "iana"
    },
    "application/batch-smtp": {
      source: "iana"
    },
    "application/bdoc": {
      compressible: false,
      extensions: ["bdoc"]
    },
    "application/beep+xml": {
      source: "iana"
    },
    "application/calendar+json": {
      source: "iana",
      compressible: true
    },
    "application/calendar+xml": {
      source: "iana"
    },
    "application/call-completion": {
      source: "iana"
    },
    "application/cals-1840": {
      source: "iana"
    },
    "application/cbor": {
      source: "iana"
    },
    "application/ccmp+xml": {
      source: "iana"
    },
    "application/ccxml+xml": {
      source: "iana",
      extensions: ["ccxml"]
    },
    "application/cdfx+xml": {
      source: "iana"
    },
    "application/cdmi-capability": {
      source: "iana",
      extensions: ["cdmia"]
    },
    "application/cdmi-container": {
      source: "iana",
      extensions: ["cdmic"]
    },
    "application/cdmi-domain": {
      source: "iana",
      extensions: ["cdmid"]
    },
    "application/cdmi-object": {
      source: "iana",
      extensions: ["cdmio"]
    },
    "application/cdmi-queue": {
      source: "iana",
      extensions: ["cdmiq"]
    },
    "application/cdni": {
      source: "iana"
    },
    "application/cea": {
      source: "iana"
    },
    "application/cea-2018+xml": {
      source: "iana"
    },
    "application/cellml+xml": {
      source: "iana"
    },
    "application/cfw": {
      source: "iana"
    },
    "application/clue_info+xml": {
      source: "iana"
    },
    "application/cms": {
      source: "iana"
    },
    "application/cnrp+xml": {
      source: "iana"
    },
    "application/coap-group+json": {
      source: "iana",
      compressible: true
    },
    "application/commonground": {
      source: "iana"
    },
    "application/conference-info+xml": {
      source: "iana"
    },
    "application/cpl+xml": {
      source: "iana"
    },
    "application/csrattrs": {
      source: "iana"
    },
    "application/csta+xml": {
      source: "iana"
    },
    "application/cstadata+xml": {
      source: "iana"
    },
    "application/csvm+json": {
      source: "iana",
      compressible: true
    },
    "application/cu-seeme": {
      source: "apache",
      extensions: ["cu"]
    },
    "application/cybercash": {
      source: "iana"
    },
    "application/dart": {
      compressible: true
    },
    "application/dash+xml": {
      source: "iana",
      extensions: ["mpd"]
    },
    "application/dashdelta": {
      source: "iana"
    },
    "application/davmount+xml": {
      source: "iana",
      extensions: ["davmount"]
    },
    "application/dca-rft": {
      source: "iana"
    },
    "application/dcd": {
      source: "iana"
    },
    "application/dec-dx": {
      source: "iana"
    },
    "application/dialog-info+xml": {
      source: "iana"
    },
    "application/dicom": {
      source: "iana"
    },
    "application/dicom+json": {
      source: "iana",
      compressible: true
    },
    "application/dicom+xml": {
      source: "iana"
    },
    "application/dii": {
      source: "iana"
    },
    "application/dit": {
      source: "iana"
    },
    "application/dns": {
      source: "iana"
    },
    "application/docbook+xml": {
      source: "apache",
      extensions: ["dbk"]
    },
    "application/dskpp+xml": {
      source: "iana"
    },
    "application/dssc+der": {
      source: "iana",
      extensions: ["dssc"]
    },
    "application/dssc+xml": {
      source: "iana",
      extensions: ["xdssc"]
    },
    "application/dvcs": {
      source: "iana"
    },
    "application/ecmascript": {
      source: "iana",
      compressible: true,
      extensions: ["ecma"]
    },
    "application/edi-consent": {
      source: "iana"
    },
    "application/edi-x12": {
      source: "iana",
      compressible: false
    },
    "application/edifact": {
      source: "iana",
      compressible: false
    },
    "application/efi": {
      source: "iana"
    },
    "application/emergencycalldata.comment+xml": {
      source: "iana"
    },
    "application/emergencycalldata.deviceinfo+xml": {
      source: "iana"
    },
    "application/emergencycalldata.providerinfo+xml": {
      source: "iana"
    },
    "application/emergencycalldata.serviceinfo+xml": {
      source: "iana"
    },
    "application/emergencycalldata.subscriberinfo+xml": {
      source: "iana"
    },
    "application/emma+xml": {
      source: "iana",
      extensions: ["emma"]
    },
    "application/emotionml+xml": {
      source: "iana"
    },
    "application/encaprtp": {
      source: "iana"
    },
    "application/epp+xml": {
      source: "iana"
    },
    "application/epub+zip": {
      source: "iana",
      extensions: ["epub"]
    },
    "application/eshop": {
      source: "iana"
    },
    "application/exi": {
      source: "iana",
      extensions: ["exi"]
    },
    "application/fastinfoset": {
      source: "iana"
    },
    "application/fastsoap": {
      source: "iana"
    },
    "application/fdt+xml": {
      source: "iana"
    },
    "application/fits": {
      source: "iana"
    },
    "application/font-sfnt": {
      source: "iana"
    },
    "application/font-tdpfr": {
      source: "iana",
      extensions: ["pfr"]
    },
    "application/font-woff": {
      source: "iana",
      compressible: false,
      extensions: ["woff"]
    },
    "application/font-woff2": {
      compressible: false,
      extensions: ["woff2"]
    },
    "application/framework-attributes+xml": {
      source: "iana"
    },
    "application/geo+json": {
      source: "iana",
      compressible: true
    },
    "application/gml+xml": {
      source: "apache",
      extensions: ["gml"]
    },
    "application/gpx+xml": {
      source: "apache",
      extensions: ["gpx"]
    },
    "application/gxf": {
      source: "apache",
      extensions: ["gxf"]
    },
    "application/gzip": {
      source: "iana",
      compressible: false
    },
    "application/h224": {
      source: "iana"
    },
    "application/held+xml": {
      source: "iana"
    },
    "application/http": {
      source: "iana"
    },
    "application/hyperstudio": {
      source: "iana",
      extensions: ["stk"]
    },
    "application/ibe-key-request+xml": {
      source: "iana"
    },
    "application/ibe-pkg-reply+xml": {
      source: "iana"
    },
    "application/ibe-pp-data": {
      source: "iana"
    },
    "application/iges": {
      source: "iana"
    },
    "application/im-iscomposing+xml": {
      source: "iana"
    },
    "application/index": {
      source: "iana"
    },
    "application/index.cmd": {
      source: "iana"
    },
    "application/index.obj": {
      source: "iana"
    },
    "application/index.response": {
      source: "iana"
    },
    "application/index.vnd": {
      source: "iana"
    },
    "application/inkml+xml": {
      source: "iana",
      extensions: ["ink", "inkml"]
    },
    "application/iotp": {
      source: "iana"
    },
    "application/ipfix": {
      source: "iana",
      extensions: ["ipfix"]
    },
    "application/ipp": {
      source: "iana"
    },
    "application/isup": {
      source: "iana"
    },
    "application/its+xml": {
      source: "iana"
    },
    "application/java-archive": {
      source: "apache",
      compressible: false,
      extensions: ["jar", "war", "ear"]
    },
    "application/java-serialized-object": {
      source: "apache",
      compressible: false,
      extensions: ["ser"]
    },
    "application/java-vm": {
      source: "apache",
      compressible: false,
      extensions: ["class"]
    },
    "application/javascript": {
      source: "iana",
      charset: "UTF-8",
      compressible: true,
      extensions: ["js"]
    },
    "application/jose": {
      source: "iana"
    },
    "application/jose+json": {
      source: "iana",
      compressible: true
    },
    "application/jrd+json": {
      source: "iana",
      compressible: true
    },
    "application/json": {
      source: "iana",
      charset: "UTF-8",
      compressible: true,
      extensions: ["json", "map"]
    },
    "application/json-patch+json": {
      source: "iana",
      compressible: true
    },
    "application/json-seq": {
      source: "iana"
    },
    "application/json5": {
      extensions: ["json5"]
    },
    "application/jsonml+json": {
      source: "apache",
      compressible: true,
      extensions: ["jsonml"]
    },
    "application/jwk+json": {
      source: "iana",
      compressible: true
    },
    "application/jwk-set+json": {
      source: "iana",
      compressible: true
    },
    "application/jwt": {
      source: "iana"
    },
    "application/kpml-request+xml": {
      source: "iana"
    },
    "application/kpml-response+xml": {
      source: "iana"
    },
    "application/ld+json": {
      source: "iana",
      compressible: true,
      extensions: ["jsonld"]
    },
    "application/lgr+xml": {
      source: "iana"
    },
    "application/link-format": {
      source: "iana"
    },
    "application/load-control+xml": {
      source: "iana"
    },
    "application/lost+xml": {
      source: "iana",
      extensions: ["lostxml"]
    },
    "application/lostsync+xml": {
      source: "iana"
    },
    "application/lxf": {
      source: "iana"
    },
    "application/mac-binhex40": {
      source: "iana",
      extensions: ["hqx"]
    },
    "application/mac-compactpro": {
      source: "apache",
      extensions: ["cpt"]
    },
    "application/macwriteii": {
      source: "iana"
    },
    "application/mads+xml": {
      source: "iana",
      extensions: ["mads"]
    },
    "application/manifest+json": {
      charset: "UTF-8",
      compressible: true,
      extensions: ["webmanifest"]
    },
    "application/marc": {
      source: "iana",
      extensions: ["mrc"]
    },
    "application/marcxml+xml": {
      source: "iana",
      extensions: ["mrcx"]
    },
    "application/mathematica": {
      source: "iana",
      extensions: ["ma", "nb", "mb"]
    },
    "application/mathml+xml": {
      source: "iana",
      extensions: ["mathml"]
    },
    "application/mathml-content+xml": {
      source: "iana"
    },
    "application/mathml-presentation+xml": {
      source: "iana"
    },
    "application/mbms-associated-procedure-description+xml": {
      source: "iana"
    },
    "application/mbms-deregister+xml": {
      source: "iana"
    },
    "application/mbms-envelope+xml": {
      source: "iana"
    },
    "application/mbms-msk+xml": {
      source: "iana"
    },
    "application/mbms-msk-response+xml": {
      source: "iana"
    },
    "application/mbms-protection-description+xml": {
      source: "iana"
    },
    "application/mbms-reception-report+xml": {
      source: "iana"
    },
    "application/mbms-register+xml": {
      source: "iana"
    },
    "application/mbms-register-response+xml": {
      source: "iana"
    },
    "application/mbms-schedule+xml": {
      source: "iana"
    },
    "application/mbms-user-service-description+xml": {
      source: "iana"
    },
    "application/mbox": {
      source: "iana",
      extensions: ["mbox"]
    },
    "application/media-policy-dataset+xml": {
      source: "iana"
    },
    "application/media_control+xml": {
      source: "iana"
    },
    "application/mediaservercontrol+xml": {
      source: "iana",
      extensions: ["mscml"]
    },
    "application/merge-patch+json": {
      source: "iana",
      compressible: true
    },
    "application/metalink+xml": {
      source: "apache",
      extensions: ["metalink"]
    },
    "application/metalink4+xml": {
      source: "iana",
      extensions: ["meta4"]
    },
    "application/mets+xml": {
      source: "iana",
      extensions: ["mets"]
    },
    "application/mf4": {
      source: "iana"
    },
    "application/mikey": {
      source: "iana"
    },
    "application/mods+xml": {
      source: "iana",
      extensions: ["mods"]
    },
    "application/moss-keys": {
      source: "iana"
    },
    "application/moss-signature": {
      source: "iana"
    },
    "application/mosskey-data": {
      source: "iana"
    },
    "application/mosskey-request": {
      source: "iana"
    },
    "application/mp21": {
      source: "iana",
      extensions: ["m21", "mp21"]
    },
    "application/mp4": {
      source: "iana",
      extensions: ["mp4s", "m4p"]
    },
    "application/mpeg4-generic": {
      source: "iana"
    },
    "application/mpeg4-iod": {
      source: "iana"
    },
    "application/mpeg4-iod-xmt": {
      source: "iana"
    },
    "application/mrb-consumer+xml": {
      source: "iana"
    },
    "application/mrb-publish+xml": {
      source: "iana"
    },
    "application/msc-ivr+xml": {
      source: "iana"
    },
    "application/msc-mixer+xml": {
      source: "iana"
    },
    "application/msword": {
      source: "iana",
      compressible: false,
      extensions: ["doc", "dot"]
    },
    "application/mxf": {
      source: "iana",
      extensions: ["mxf"]
    },
    "application/nasdata": {
      source: "iana"
    },
    "application/news-checkgroups": {
      source: "iana"
    },
    "application/news-groupinfo": {
      source: "iana"
    },
    "application/news-transmission": {
      source: "iana"
    },
    "application/nlsml+xml": {
      source: "iana"
    },
    "application/nss": {
      source: "iana"
    },
    "application/ocsp-request": {
      source: "iana"
    },
    "application/ocsp-response": {
      source: "iana"
    },
    "application/octet-stream": {
      source: "iana",
      compressible: false,
      extensions: ["bin", "dms", "lrf", "mar", "so", "dist", "distz", "pkg", "bpk", "dump", "elc", "deploy", "exe", "dll", "deb", "dmg", "iso", "img", "msi", "msp", "msm", "buffer"]
    },
    "application/oda": {
      source: "iana",
      extensions: ["oda"]
    },
    "application/odx": {
      source: "iana"
    },
    "application/oebps-package+xml": {
      source: "iana",
      extensions: ["opf"]
    },
    "application/ogg": {
      source: "iana",
      compressible: false,
      extensions: ["ogx"]
    },
    "application/omdoc+xml": {
      source: "apache",
      extensions: ["omdoc"]
    },
    "application/onenote": {
      source: "apache",
      extensions: ["onetoc", "onetoc2", "onetmp", "onepkg"]
    },
    "application/oxps": {
      source: "iana",
      extensions: ["oxps"]
    },
    "application/p2p-overlay+xml": {
      source: "iana"
    },
    "application/parityfec": {
      source: "iana"
    },
    "application/patch-ops-error+xml": {
      source: "iana",
      extensions: ["xer"]
    },
    "application/pdf": {
      source: "iana",
      compressible: false,
      extensions: ["pdf"]
    },
    "application/pdx": {
      source: "iana"
    },
    "application/pgp-encrypted": {
      source: "iana",
      compressible: false,
      extensions: ["pgp"]
    },
    "application/pgp-keys": {
      source: "iana"
    },
    "application/pgp-signature": {
      source: "iana",
      extensions: ["asc", "sig"]
    },
    "application/pics-rules": {
      source: "apache",
      extensions: ["prf"]
    },
    "application/pidf+xml": {
      source: "iana"
    },
    "application/pidf-diff+xml": {
      source: "iana"
    },
    "application/pkcs10": {
      source: "iana",
      extensions: ["p10"]
    },
    "application/pkcs12": {
      source: "iana"
    },
    "application/pkcs7-mime": {
      source: "iana",
      extensions: ["p7m", "p7c"]
    },
    "application/pkcs7-signature": {
      source: "iana",
      extensions: ["p7s"]
    },
    "application/pkcs8": {
      source: "iana",
      extensions: ["p8"]
    },
    "application/pkix-attr-cert": {
      source: "iana",
      extensions: ["ac"]
    },
    "application/pkix-cert": {
      source: "iana",
      extensions: ["cer"]
    },
    "application/pkix-crl": {
      source: "iana",
      extensions: ["crl"]
    },
    "application/pkix-pkipath": {
      source: "iana",
      extensions: ["pkipath"]
    },
    "application/pkixcmp": {
      source: "iana",
      extensions: ["pki"]
    },
    "application/pls+xml": {
      source: "iana",
      extensions: ["pls"]
    },
    "application/poc-settings+xml": {
      source: "iana"
    },
    "application/postscript": {
      source: "iana",
      compressible: true,
      extensions: ["ai", "eps", "ps"]
    },
    "application/ppsp-tracker+json": {
      source: "iana",
      compressible: true
    },
    "application/problem+json": {
      source: "iana",
      compressible: true
    },
    "application/problem+xml": {
      source: "iana"
    },
    "application/provenance+xml": {
      source: "iana"
    },
    "application/prs.alvestrand.titrax-sheet": {
      source: "iana"
    },
    "application/prs.cww": {
      source: "iana",
      extensions: ["cww"]
    },
    "application/prs.hpub+zip": {
      source: "iana"
    },
    "application/prs.nprend": {
      source: "iana"
    },
    "application/prs.plucker": {
      source: "iana"
    },
    "application/prs.rdf-xml-crypt": {
      source: "iana"
    },
    "application/prs.xsf+xml": {
      source: "iana"
    },
    "application/pskc+xml": {
      source: "iana",
      extensions: ["pskcxml"]
    },
    "application/qsig": {
      source: "iana"
    },
    "application/raptorfec": {
      source: "iana"
    },
    "application/rdap+json": {
      source: "iana",
      compressible: true
    },
    "application/rdf+xml": {
      source: "iana",
      compressible: true,
      extensions: ["rdf"]
    },
    "application/reginfo+xml": {
      source: "iana",
      extensions: ["rif"]
    },
    "application/relax-ng-compact-syntax": {
      source: "iana",
      extensions: ["rnc"]
    },
    "application/remote-printing": {
      source: "iana"
    },
    "application/reputon+json": {
      source: "iana",
      compressible: true
    },
    "application/resource-lists+xml": {
      source: "iana",
      extensions: ["rl"]
    },
    "application/resource-lists-diff+xml": {
      source: "iana",
      extensions: ["rld"]
    },
    "application/rfc+xml": {
      source: "iana"
    },
    "application/riscos": {
      source: "iana"
    },
    "application/rlmi+xml": {
      source: "iana"
    },
    "application/rls-services+xml": {
      source: "iana",
      extensions: ["rs"]
    },
    "application/rpki-ghostbusters": {
      source: "iana",
      extensions: ["gbr"]
    },
    "application/rpki-manifest": {
      source: "iana",
      extensions: ["mft"]
    },
    "application/rpki-roa": {
      source: "iana",
      extensions: ["roa"]
    },
    "application/rpki-updown": {
      source: "iana"
    },
    "application/rsd+xml": {
      source: "apache",
      extensions: ["rsd"]
    },
    "application/rss+xml": {
      source: "apache",
      compressible: true,
      extensions: ["rss"]
    },
    "application/rtf": {
      source: "iana",
      compressible: true,
      extensions: ["rtf"]
    },
    "application/rtploopback": {
      source: "iana"
    },
    "application/rtx": {
      source: "iana"
    },
    "application/samlassertion+xml": {
      source: "iana"
    },
    "application/samlmetadata+xml": {
      source: "iana"
    },
    "application/sbml+xml": {
      source: "iana",
      extensions: ["sbml"]
    },
    "application/scaip+xml": {
      source: "iana"
    },
    "application/scim+json": {
      source: "iana",
      compressible: true
    },
    "application/scvp-cv-request": {
      source: "iana",
      extensions: ["scq"]
    },
    "application/scvp-cv-response": {
      source: "iana",
      extensions: ["scs"]
    },
    "application/scvp-vp-request": {
      source: "iana",
      extensions: ["spq"]
    },
    "application/scvp-vp-response": {
      source: "iana",
      extensions: ["spp"]
    },
    "application/sdp": {
      source: "iana",
      extensions: ["sdp"]
    },
    "application/sep+xml": {
      source: "iana"
    },
    "application/sep-exi": {
      source: "iana"
    },
    "application/session-info": {
      source: "iana"
    },
    "application/set-payment": {
      source: "iana"
    },
    "application/set-payment-initiation": {
      source: "iana",
      extensions: ["setpay"]
    },
    "application/set-registration": {
      source: "iana"
    },
    "application/set-registration-initiation": {
      source: "iana",
      extensions: ["setreg"]
    },
    "application/sgml": {
      source: "iana"
    },
    "application/sgml-open-catalog": {
      source: "iana"
    },
    "application/shf+xml": {
      source: "iana",
      extensions: ["shf"]
    },
    "application/sieve": {
      source: "iana"
    },
    "application/simple-filter+xml": {
      source: "iana"
    },
    "application/simple-message-summary": {
      source: "iana"
    },
    "application/simplesymbolcontainer": {
      source: "iana"
    },
    "application/slate": {
      source: "iana"
    },
    "application/smil": {
      source: "iana"
    },
    "application/smil+xml": {
      source: "iana",
      extensions: ["smi", "smil"]
    },
    "application/smpte336m": {
      source: "iana"
    },
    "application/soap+fastinfoset": {
      source: "iana"
    },
    "application/soap+xml": {
      source: "iana",
      compressible: true
    },
    "application/sparql-query": {
      source: "iana",
      extensions: ["rq"]
    },
    "application/sparql-results+xml": {
      source: "iana",
      extensions: ["srx"]
    },
    "application/spirits-event+xml": {
      source: "iana"
    },
    "application/sql": {
      source: "iana"
    },
    "application/srgs": {
      source: "iana",
      extensions: ["gram"]
    },
    "application/srgs+xml": {
      source: "iana",
      extensions: ["grxml"]
    },
    "application/sru+xml": {
      source: "iana",
      extensions: ["sru"]
    },
    "application/ssdl+xml": {
      source: "apache",
      extensions: ["ssdl"]
    },
    "application/ssml+xml": {
      source: "iana",
      extensions: ["ssml"]
    },
    "application/tamp-apex-update": {
      source: "iana"
    },
    "application/tamp-apex-update-confirm": {
      source: "iana"
    },
    "application/tamp-community-update": {
      source: "iana"
    },
    "application/tamp-community-update-confirm": {
      source: "iana"
    },
    "application/tamp-error": {
      source: "iana"
    },
    "application/tamp-sequence-adjust": {
      source: "iana"
    },
    "application/tamp-sequence-adjust-confirm": {
      source: "iana"
    },
    "application/tamp-status-query": {
      source: "iana"
    },
    "application/tamp-status-response": {
      source: "iana"
    },
    "application/tamp-update": {
      source: "iana"
    },
    "application/tamp-update-confirm": {
      source: "iana"
    },
    "application/tar": {
      compressible: true
    },
    "application/tei+xml": {
      source: "iana",
      extensions: ["tei", "teicorpus"]
    },
    "application/thraud+xml": {
      source: "iana",
      extensions: ["tfi"]
    },
    "application/timestamp-query": {
      source: "iana"
    },
    "application/timestamp-reply": {
      source: "iana"
    },
    "application/timestamped-data": {
      source: "iana",
      extensions: ["tsd"]
    },
    "application/ttml+xml": {
      source: "iana"
    },
    "application/tve-trigger": {
      source: "iana"
    },
    "application/ulpfec": {
      source: "iana"
    },
    "application/urc-grpsheet+xml": {
      source: "iana"
    },
    "application/urc-ressheet+xml": {
      source: "iana"
    },
    "application/urc-targetdesc+xml": {
      source: "iana"
    },
    "application/urc-uisocketdesc+xml": {
      source: "iana"
    },
    "application/vcard+json": {
      source: "iana",
      compressible: true
    },
    "application/vcard+xml": {
      source: "iana"
    },
    "application/vemmi": {
      source: "iana"
    },
    "application/vividence.scriptfile": {
      source: "apache"
    },
    "application/vnd.3gpp-prose+xml": {
      source: "iana"
    },
    "application/vnd.3gpp-prose-pc3ch+xml": {
      source: "iana"
    },
    "application/vnd.3gpp.access-transfer-events+xml": {
      source: "iana"
    },
    "application/vnd.3gpp.bsf+xml": {
      source: "iana"
    },
    "application/vnd.3gpp.mid-call+xml": {
      source: "iana"
    },
    "application/vnd.3gpp.pic-bw-large": {
      source: "iana",
      extensions: ["plb"]
    },
    "application/vnd.3gpp.pic-bw-small": {
      source: "iana",
      extensions: ["psb"]
    },
    "application/vnd.3gpp.pic-bw-var": {
      source: "iana",
      extensions: ["pvb"]
    },
    "application/vnd.3gpp.sms": {
      source: "iana"
    },
    "application/vnd.3gpp.sms+xml": {
      source: "iana"
    },
    "application/vnd.3gpp.srvcc-ext+xml": {
      source: "iana"
    },
    "application/vnd.3gpp.srvcc-info+xml": {
      source: "iana"
    },
    "application/vnd.3gpp.state-and-event-info+xml": {
      source: "iana"
    },
    "application/vnd.3gpp.ussd+xml": {
      source: "iana"
    },
    "application/vnd.3gpp2.bcmcsinfo+xml": {
      source: "iana"
    },
    "application/vnd.3gpp2.sms": {
      source: "iana"
    },
    "application/vnd.3gpp2.tcap": {
      source: "iana",
      extensions: ["tcap"]
    },
    "application/vnd.3lightssoftware.imagescal": {
      source: "iana"
    },
    "application/vnd.3m.post-it-notes": {
      source: "iana",
      extensions: ["pwn"]
    },
    "application/vnd.accpac.simply.aso": {
      source: "iana",
      extensions: ["aso"]
    },
    "application/vnd.accpac.simply.imp": {
      source: "iana",
      extensions: ["imp"]
    },
    "application/vnd.acucobol": {
      source: "iana",
      extensions: ["acu"]
    },
    "application/vnd.acucorp": {
      source: "iana",
      extensions: ["atc", "acutc"]
    },
    "application/vnd.adobe.air-application-installer-package+zip": {
      source: "apache",
      extensions: ["air"]
    },
    "application/vnd.adobe.flash.movie": {
      source: "iana"
    },
    "application/vnd.adobe.formscentral.fcdt": {
      source: "iana",
      extensions: ["fcdt"]
    },
    "application/vnd.adobe.fxp": {
      source: "iana",
      extensions: ["fxp", "fxpl"]
    },
    "application/vnd.adobe.partial-upload": {
      source: "iana"
    },
    "application/vnd.adobe.xdp+xml": {
      source: "iana",
      extensions: ["xdp"]
    },
    "application/vnd.adobe.xfdf": {
      source: "iana",
      extensions: ["xfdf"]
    },
    "application/vnd.aether.imp": {
      source: "iana"
    },
    "application/vnd.ah-barcode": {
      source: "iana"
    },
    "application/vnd.ahead.space": {
      source: "iana",
      extensions: ["ahead"]
    },
    "application/vnd.airzip.filesecure.azf": {
      source: "iana",
      extensions: ["azf"]
    },
    "application/vnd.airzip.filesecure.azs": {
      source: "iana",
      extensions: ["azs"]
    },
    "application/vnd.amazon.ebook": {
      source: "apache",
      extensions: ["azw"]
    },
    "application/vnd.amazon.mobi8-ebook": {
      source: "iana"
    },
    "application/vnd.americandynamics.acc": {
      source: "iana",
      extensions: ["acc"]
    },
    "application/vnd.amiga.ami": {
      source: "iana",
      extensions: ["ami"]
    },
    "application/vnd.amundsen.maze+xml": {
      source: "iana"
    },
    "application/vnd.android.package-archive": {
      source: "apache",
      compressible: false,
      extensions: ["apk"]
    },
    "application/vnd.anki": {
      source: "iana"
    },
    "application/vnd.anser-web-certificate-issue-initiation": {
      source: "iana",
      extensions: ["cii"]
    },
    "application/vnd.anser-web-funds-transfer-initiation": {
      source: "apache",
      extensions: ["fti"]
    },
    "application/vnd.antix.game-component": {
      source: "iana",
      extensions: ["atx"]
    },
    "application/vnd.apache.thrift.binary": {
      source: "iana"
    },
    "application/vnd.apache.thrift.compact": {
      source: "iana"
    },
    "application/vnd.apache.thrift.json": {
      source: "iana"
    },
    "application/vnd.api+json": {
      source: "iana",
      compressible: true
    },
    "application/vnd.apple.installer+xml": {
      source: "iana",
      extensions: ["mpkg"]
    },
    "application/vnd.apple.mpegurl": {
      source: "iana",
      extensions: ["m3u8"]
    },
    "application/vnd.apple.pkpass": {
      compressible: false,
      extensions: ["pkpass"]
    },
    "application/vnd.arastra.swi": {
      source: "iana"
    },
    "application/vnd.aristanetworks.swi": {
      source: "iana",
      extensions: ["swi"]
    },
    "application/vnd.artsquare": {
      source: "iana"
    },
    "application/vnd.astraea-software.iota": {
      source: "iana",
      extensions: ["iota"]
    },
    "application/vnd.audiograph": {
      source: "iana",
      extensions: ["aep"]
    },
    "application/vnd.autopackage": {
      source: "iana"
    },
    "application/vnd.avistar+xml": {
      source: "iana"
    },
    "application/vnd.balsamiq.bmml+xml": {
      source: "iana"
    },
    "application/vnd.balsamiq.bmpr": {
      source: "iana"
    },
    "application/vnd.bekitzur-stech+json": {
      source: "iana",
      compressible: true
    },
    "application/vnd.biopax.rdf+xml": {
      source: "iana"
    },
    "application/vnd.blueice.multipass": {
      source: "iana",
      extensions: ["mpm"]
    },
    "application/vnd.bluetooth.ep.oob": {
      source: "iana"
    },
    "application/vnd.bluetooth.le.oob": {
      source: "iana"
    },
    "application/vnd.bmi": {
      source: "iana",
      extensions: ["bmi"]
    },
    "application/vnd.businessobjects": {
      source: "iana",
      extensions: ["rep"]
    },
    "application/vnd.cab-jscript": {
      source: "iana"
    },
    "application/vnd.canon-cpdl": {
      source: "iana"
    },
    "application/vnd.canon-lips": {
      source: "iana"
    },
    "application/vnd.cendio.thinlinc.clientconf": {
      source: "iana"
    },
    "application/vnd.century-systems.tcp_stream": {
      source: "iana"
    },
    "application/vnd.chemdraw+xml": {
      source: "iana",
      extensions: ["cdxml"]
    },
    "application/vnd.chess-pgn": {
      source: "iana"
    },
    "application/vnd.chipnuts.karaoke-mmd": {
      source: "iana",
      extensions: ["mmd"]
    },
    "application/vnd.cinderella": {
      source: "iana",
      extensions: ["cdy"]
    },
    "application/vnd.cirpack.isdn-ext": {
      source: "iana"
    },
    "application/vnd.citationstyles.style+xml": {
      source: "iana"
    },
    "application/vnd.claymore": {
      source: "iana",
      extensions: ["cla"]
    },
    "application/vnd.cloanto.rp9": {
      source: "iana",
      extensions: ["rp9"]
    },
    "application/vnd.clonk.c4group": {
      source: "iana",
      extensions: ["c4g", "c4d", "c4f", "c4p", "c4u"]
    },
    "application/vnd.cluetrust.cartomobile-config": {
      source: "iana",
      extensions: ["c11amc"]
    },
    "application/vnd.cluetrust.cartomobile-config-pkg": {
      source: "iana",
      extensions: ["c11amz"]
    },
    "application/vnd.coffeescript": {
      source: "iana"
    },
    "application/vnd.collection+json": {
      source: "iana",
      compressible: true
    },
    "application/vnd.collection.doc+json": {
      source: "iana",
      compressible: true
    },
    "application/vnd.collection.next+json": {
      source: "iana",
      compressible: true
    },
    "application/vnd.comicbook+zip": {
      source: "iana"
    },
    "application/vnd.commerce-battelle": {
      source: "iana"
    },
    "application/vnd.commonspace": {
      source: "iana",
      extensions: ["csp"]
    },
    "application/vnd.contact.cmsg": {
      source: "iana",
      extensions: ["cdbcmsg"]
    },
    "application/vnd.coreos.ignition+json": {
      source: "iana",
      compressible: true
    },
    "application/vnd.cosmocaller": {
      source: "iana",
      extensions: ["cmc"]
    },
    "application/vnd.crick.clicker": {
      source: "iana",
      extensions: ["clkx"]
    },
    "application/vnd.crick.clicker.keyboard": {
      source: "iana",
      extensions: ["clkk"]
    },
    "application/vnd.crick.clicker.palette": {
      source: "iana",
      extensions: ["clkp"]
    },
    "application/vnd.crick.clicker.template": {
      source: "iana",
      extensions: ["clkt"]
    },
    "application/vnd.crick.clicker.wordbank": {
      source: "iana",
      extensions: ["clkw"]
    },
    "application/vnd.criticaltools.wbs+xml": {
      source: "iana",
      extensions: ["wbs"]
    },
    "application/vnd.ctc-posml": {
      source: "iana",
      extensions: ["pml"]
    },
    "application/vnd.ctct.ws+xml": {
      source: "iana"
    },
    "application/vnd.cups-pdf": {
      source: "iana"
    },
    "application/vnd.cups-postscript": {
      source: "iana"
    },
    "application/vnd.cups-ppd": {
      source: "iana",
      extensions: ["ppd"]
    },
    "application/vnd.cups-raster": {
      source: "iana"
    },
    "application/vnd.cups-raw": {
      source: "iana"
    },
    "application/vnd.curl": {
      source: "iana"
    },
    "application/vnd.curl.car": {
      source: "apache",
      extensions: ["car"]
    },
    "application/vnd.curl.pcurl": {
      source: "apache",
      extensions: ["pcurl"]
    },
    "application/vnd.cyan.dean.root+xml": {
      source: "iana"
    },
    "application/vnd.cybank": {
      source: "iana"
    },
    "application/vnd.d2l.coursepackage1p0+zip": {
      source: "iana"
    },
    "application/vnd.dart": {
      source: "iana",
      compressible: true,
      extensions: ["dart"]
    },
    "application/vnd.data-vision.rdz": {
      source: "iana",
      extensions: ["rdz"]
    },
    "application/vnd.debian.binary-package": {
      source: "iana"
    },
    "application/vnd.dece.data": {
      source: "iana",
      extensions: ["uvf", "uvvf", "uvd", "uvvd"]
    },
    "application/vnd.dece.ttml+xml": {
      source: "iana",
      extensions: ["uvt", "uvvt"]
    },
    "application/vnd.dece.unspecified": {
      source: "iana",
      extensions: ["uvx", "uvvx"]
    },
    "application/vnd.dece.zip": {
      source: "iana",
      extensions: ["uvz", "uvvz"]
    },
    "application/vnd.denovo.fcselayout-link": {
      source: "iana",
      extensions: ["fe_launch"]
    },
    "application/vnd.desmume-movie": {
      source: "iana"
    },
    "application/vnd.desmume.movie": {
      source: "apache"
    },
    "application/vnd.dir-bi.plate-dl-nosuffix": {
      source: "iana"
    },
    "application/vnd.dm.delegation+xml": {
      source: "iana"
    },
    "application/vnd.dna": {
      source: "iana",
      extensions: ["dna"]
    },
    "application/vnd.document+json": {
      source: "iana",
      compressible: true
    },
    "application/vnd.dolby.mlp": {
      source: "apache",
      extensions: ["mlp"]
    },
    "application/vnd.dolby.mobile.1": {
      source: "iana"
    },
    "application/vnd.dolby.mobile.2": {
      source: "iana"
    },
    "application/vnd.doremir.scorecloud-binary-document": {
      source: "iana"
    },
    "application/vnd.dpgraph": {
      source: "iana",
      extensions: ["dpg"]
    },
    "application/vnd.dreamfactory": {
      source: "iana",
      extensions: ["dfac"]
    },
    "application/vnd.drive+json": {
      source: "iana",
      compressible: true
    },
    "application/vnd.ds-keypoint": {
      source: "apache",
      extensions: ["kpxx"]
    },
    "application/vnd.dtg.local": {
      source: "iana"
    },
    "application/vnd.dtg.local.flash": {
      source: "iana"
    },
    "application/vnd.dtg.local.html": {
      source: "iana"
    },
    "application/vnd.dvb.ait": {
      source: "iana",
      extensions: ["ait"]
    },
    "application/vnd.dvb.dvbj": {
      source: "iana"
    },
    "application/vnd.dvb.esgcontainer": {
      source: "iana"
    },
    "application/vnd.dvb.ipdcdftnotifaccess": {
      source: "iana"
    },
    "application/vnd.dvb.ipdcesgaccess": {
      source: "iana"
    },
    "application/vnd.dvb.ipdcesgaccess2": {
      source: "iana"
    },
    "application/vnd.dvb.ipdcesgpdd": {
      source: "iana"
    },
    "application/vnd.dvb.ipdcroaming": {
      source: "iana"
    },
    "application/vnd.dvb.iptv.alfec-base": {
      source: "iana"
    },
    "application/vnd.dvb.iptv.alfec-enhancement": {
      source: "iana"
    },
    "application/vnd.dvb.notif-aggregate-root+xml": {
      source: "iana"
    },
    "application/vnd.dvb.notif-container+xml": {
      source: "iana"
    },
    "application/vnd.dvb.notif-generic+xml": {
      source: "iana"
    },
    "application/vnd.dvb.notif-ia-msglist+xml": {
      source: "iana"
    },
    "application/vnd.dvb.notif-ia-registration-request+xml": {
      source: "iana"
    },
    "application/vnd.dvb.notif-ia-registration-response+xml": {
      source: "iana"
    },
    "application/vnd.dvb.notif-init+xml": {
      source: "iana"
    },
    "application/vnd.dvb.pfr": {
      source: "iana"
    },
    "application/vnd.dvb.service": {
      source: "iana",
      extensions: ["svc"]
    },
    "application/vnd.dxr": {
      source: "iana"
    },
    "application/vnd.dynageo": {
      source: "iana",
      extensions: ["geo"]
    },
    "application/vnd.dzr": {
      source: "iana"
    },
    "application/vnd.easykaraoke.cdgdownload": {
      source: "iana"
    },
    "application/vnd.ecdis-update": {
      source: "iana"
    },
    "application/vnd.ecowin.chart": {
      source: "iana",
      extensions: ["mag"]
    },
    "application/vnd.ecowin.filerequest": {
      source: "iana"
    },
    "application/vnd.ecowin.fileupdate": {
      source: "iana"
    },
    "application/vnd.ecowin.series": {
      source: "iana"
    },
    "application/vnd.ecowin.seriesrequest": {
      source: "iana"
    },
    "application/vnd.ecowin.seriesupdate": {
      source: "iana"
    },
    "application/vnd.emclient.accessrequest+xml": {
      source: "iana"
    },
    "application/vnd.enliven": {
      source: "iana",
      extensions: ["nml"]
    },
    "application/vnd.enphase.envoy": {
      source: "iana"
    },
    "application/vnd.eprints.data+xml": {
      source: "iana"
    },
    "application/vnd.epson.esf": {
      source: "iana",
      extensions: ["esf"]
    },
    "application/vnd.epson.msf": {
      source: "iana",
      extensions: ["msf"]
    },
    "application/vnd.epson.quickanime": {
      source: "iana",
      extensions: ["qam"]
    },
    "application/vnd.epson.salt": {
      source: "iana",
      extensions: ["slt"]
    },
    "application/vnd.epson.ssf": {
      source: "iana",
      extensions: ["ssf"]
    },
    "application/vnd.ericsson.quickcall": {
      source: "iana"
    },
    "application/vnd.espass-espass+zip": {
      source: "iana"
    },
    "application/vnd.eszigno3+xml": {
      source: "iana",
      extensions: ["es3", "et3"]
    },
    "application/vnd.etsi.aoc+xml": {
      source: "iana"
    },
    "application/vnd.etsi.asic-e+zip": {
      source: "iana"
    },
    "application/vnd.etsi.asic-s+zip": {
      source: "iana"
    },
    "application/vnd.etsi.cug+xml": {
      source: "iana"
    },
    "application/vnd.etsi.iptvcommand+xml": {
      source: "iana"
    },
    "application/vnd.etsi.iptvdiscovery+xml": {
      source: "iana"
    },
    "application/vnd.etsi.iptvprofile+xml": {
      source: "iana"
    },
    "application/vnd.etsi.iptvsad-bc+xml": {
      source: "iana"
    },
    "application/vnd.etsi.iptvsad-cod+xml": {
      source: "iana"
    },
    "application/vnd.etsi.iptvsad-npvr+xml": {
      source: "iana"
    },
    "application/vnd.etsi.iptvservice+xml": {
      source: "iana"
    },
    "application/vnd.etsi.iptvsync+xml": {
      source: "iana"
    },
    "application/vnd.etsi.iptvueprofile+xml": {
      source: "iana"
    },
    "application/vnd.etsi.mcid+xml": {
      source: "iana"
    },
    "application/vnd.etsi.mheg5": {
      source: "iana"
    },
    "application/vnd.etsi.overload-control-policy-dataset+xml": {
      source: "iana"
    },
    "application/vnd.etsi.pstn+xml": {
      source: "iana"
    },
    "application/vnd.etsi.sci+xml": {
      source: "iana"
    },
    "application/vnd.etsi.simservs+xml": {
      source: "iana"
    },
    "application/vnd.etsi.timestamp-token": {
      source: "iana"
    },
    "application/vnd.etsi.tsl+xml": {
      source: "iana"
    },
    "application/vnd.etsi.tsl.der": {
      source: "iana"
    },
    "application/vnd.eudora.data": {
      source: "iana"
    },
    "application/vnd.ezpix-album": {
      source: "iana",
      extensions: ["ez2"]
    },
    "application/vnd.ezpix-package": {
      source: "iana",
      extensions: ["ez3"]
    },
    "application/vnd.f-secure.mobile": {
      source: "iana"
    },
    "application/vnd.fastcopy-disk-image": {
      source: "iana"
    },
    "application/vnd.fdf": {
      source: "iana",
      extensions: ["fdf"]
    },
    "application/vnd.fdsn.mseed": {
      source: "iana",
      extensions: ["mseed"]
    },
    "application/vnd.fdsn.seed": {
      source: "iana",
      extensions: ["seed", "dataless"]
    },
    "application/vnd.ffsns": {
      source: "iana"
    },
    "application/vnd.filmit.zfc": {
      source: "iana"
    },
    "application/vnd.fints": {
      source: "iana"
    },
    "application/vnd.firemonkeys.cloudcell": {
      source: "iana"
    },
    "application/vnd.flographit": {
      source: "iana",
      extensions: ["gph"]
    },
    "application/vnd.fluxtime.clip": {
      source: "iana",
      extensions: ["ftc"]
    },
    "application/vnd.font-fontforge-sfd": {
      source: "iana"
    },
    "application/vnd.framemaker": {
      source: "iana",
      extensions: ["fm", "frame", "maker", "book"]
    },
    "application/vnd.frogans.fnc": {
      source: "iana",
      extensions: ["fnc"]
    },
    "application/vnd.frogans.ltf": {
      source: "iana",
      extensions: ["ltf"]
    },
    "application/vnd.fsc.weblaunch": {
      source: "iana",
      extensions: ["fsc"]
    },
    "application/vnd.fujitsu.oasys": {
      source: "iana",
      extensions: ["oas"]
    },
    "application/vnd.fujitsu.oasys2": {
      source: "iana",
      extensions: ["oa2"]
    },
    "application/vnd.fujitsu.oasys3": {
      source: "iana",
      extensions: ["oa3"]
    },
    "application/vnd.fujitsu.oasysgp": {
      source: "iana",
      extensions: ["fg5"]
    },
    "application/vnd.fujitsu.oasysprs": {
      source: "iana",
      extensions: ["bh2"]
    },
    "application/vnd.fujixerox.art-ex": {
      source: "iana"
    },
    "application/vnd.fujixerox.art4": {
      source: "iana"
    },
    "application/vnd.fujixerox.ddd": {
      source: "iana",
      extensions: ["ddd"]
    },
    "application/vnd.fujixerox.docuworks": {
      source: "iana",
      extensions: ["xdw"]
    },
    "application/vnd.fujixerox.docuworks.binder": {
      source: "iana",
      extensions: ["xbd"]
    },
    "application/vnd.fujixerox.docuworks.container": {
      source: "iana"
    },
    "application/vnd.fujixerox.hbpl": {
      source: "iana"
    },
    "application/vnd.fut-misnet": {
      source: "iana"
    },
    "application/vnd.fuzzysheet": {
      source: "iana",
      extensions: ["fzs"]
    },
    "application/vnd.genomatix.tuxedo": {
      source: "iana",
      extensions: ["txd"]
    },
    "application/vnd.geo+json": {
      source: "iana",
      compressible: true
    },
    "application/vnd.geocube+xml": {
      source: "iana"
    },
    "application/vnd.geogebra.file": {
      source: "iana",
      extensions: ["ggb"]
    },
    "application/vnd.geogebra.tool": {
      source: "iana",
      extensions: ["ggt"]
    },
    "application/vnd.geometry-explorer": {
      source: "iana",
      extensions: ["gex", "gre"]
    },
    "application/vnd.geonext": {
      source: "iana",
      extensions: ["gxt"]
    },
    "application/vnd.geoplan": {
      source: "iana",
      extensions: ["g2w"]
    },
    "application/vnd.geospace": {
      source: "iana",
      extensions: ["g3w"]
    },
    "application/vnd.gerber": {
      source: "iana"
    },
    "application/vnd.globalplatform.card-content-mgt": {
      source: "iana"
    },
    "application/vnd.globalplatform.card-content-mgt-response": {
      source: "iana"
    },
    "application/vnd.gmx": {
      source: "iana",
      extensions: ["gmx"]
    },
    "application/vnd.google-apps.document": {
      compressible: false,
      extensions: ["gdoc"]
    },
    "application/vnd.google-apps.presentation": {
      compressible: false,
      extensions: ["gslides"]
    },
    "application/vnd.google-apps.spreadsheet": {
      compressible: false,
      extensions: ["gsheet"]
    },
    "application/vnd.google-earth.kml+xml": {
      source: "iana",
      compressible: true,
      extensions: ["kml"]
    },
    "application/vnd.google-earth.kmz": {
      source: "iana",
      compressible: false,
      extensions: ["kmz"]
    },
    "application/vnd.gov.sk.e-form+xml": {
      source: "iana"
    },
    "application/vnd.gov.sk.e-form+zip": {
      source: "iana"
    },
    "application/vnd.gov.sk.xmldatacontainer+xml": {
      source: "iana"
    },
    "application/vnd.grafeq": {
      source: "iana",
      extensions: ["gqf", "gqs"]
    },
    "application/vnd.gridmp": {
      source: "iana"
    },
    "application/vnd.groove-account": {
      source: "iana",
      extensions: ["gac"]
    },
    "application/vnd.groove-help": {
      source: "iana",
      extensions: ["ghf"]
    },
    "application/vnd.groove-identity-message": {
      source: "iana",
      extensions: ["gim"]
    },
    "application/vnd.groove-injector": {
      source: "iana",
      extensions: ["grv"]
    },
    "application/vnd.groove-tool-message": {
      source: "iana",
      extensions: ["gtm"]
    },
    "application/vnd.groove-tool-template": {
      source: "iana",
      extensions: ["tpl"]
    },
    "application/vnd.groove-vcard": {
      source: "iana",
      extensions: ["vcg"]
    },
    "application/vnd.hal+json": {
      source: "iana",
      compressible: true
    },
    "application/vnd.hal+xml": {
      source: "iana",
      extensions: ["hal"]
    },
    "application/vnd.handheld-entertainment+xml": {
      source: "iana",
      extensions: ["zmm"]
    },
    "application/vnd.hbci": {
      source: "iana",
      extensions: ["hbci"]
    },
    "application/vnd.hcl-bireports": {
      source: "iana"
    },
    "application/vnd.hdt": {
      source: "iana"
    },
    "application/vnd.heroku+json": {
      source: "iana",
      compressible: true
    },
    "application/vnd.hhe.lesson-player": {
      source: "iana",
      extensions: ["les"]
    },
    "application/vnd.hp-hpgl": {
      source: "iana",
      extensions: ["hpgl"]
    },
    "application/vnd.hp-hpid": {
      source: "iana",
      extensions: ["hpid"]
    },
    "application/vnd.hp-hps": {
      source: "iana",
      extensions: ["hps"]
    },
    "application/vnd.hp-jlyt": {
      source: "iana",
      extensions: ["jlt"]
    },
    "application/vnd.hp-pcl": {
      source: "iana",
      extensions: ["pcl"]
    },
    "application/vnd.hp-pclxl": {
      source: "iana",
      extensions: ["pclxl"]
    },
    "application/vnd.httphone": {
      source: "iana"
    },
    "application/vnd.hydrostatix.sof-data": {
      source: "iana",
      extensions: ["sfd-hdstx"]
    },
    "application/vnd.hyperdrive+json": {
      source: "iana",
      compressible: true
    },
    "application/vnd.hzn-3d-crossword": {
      source: "iana"
    },
    "application/vnd.ibm.afplinedata": {
      source: "iana"
    },
    "application/vnd.ibm.electronic-media": {
      source: "iana"
    },
    "application/vnd.ibm.minipay": {
      source: "iana",
      extensions: ["mpy"]
    },
    "application/vnd.ibm.modcap": {
      source: "iana",
      extensions: ["afp", "listafp", "list3820"]
    },
    "application/vnd.ibm.rights-management": {
      source: "iana",
      extensions: ["irm"]
    },
    "application/vnd.ibm.secure-container": {
      source: "iana",
      extensions: ["sc"]
    },
    "application/vnd.iccprofile": {
      source: "iana",
      extensions: ["icc", "icm"]
    },
    "application/vnd.ieee.1905": {
      source: "iana"
    },
    "application/vnd.igloader": {
      source: "iana",
      extensions: ["igl"]
    },
    "application/vnd.immervision-ivp": {
      source: "iana",
      extensions: ["ivp"]
    },
    "application/vnd.immervision-ivu": {
      source: "iana",
      extensions: ["ivu"]
    },
    "application/vnd.ims.imsccv1p1": {
      source: "iana"
    },
    "application/vnd.ims.imsccv1p2": {
      source: "iana"
    },
    "application/vnd.ims.imsccv1p3": {
      source: "iana"
    },
    "application/vnd.ims.lis.v2.result+json": {
      source: "iana",
      compressible: true
    },
    "application/vnd.ims.lti.v2.toolconsumerprofile+json": {
      source: "iana",
      compressible: true
    },
    "application/vnd.ims.lti.v2.toolproxy+json": {
      source: "iana",
      compressible: true
    },
    "application/vnd.ims.lti.v2.toolproxy.id+json": {
      source: "iana",
      compressible: true
    },
    "application/vnd.ims.lti.v2.toolsettings+json": {
      source: "iana",
      compressible: true
    },
    "application/vnd.ims.lti.v2.toolsettings.simple+json": {
      source: "iana",
      compressible: true
    },
    "application/vnd.informedcontrol.rms+xml": {
      source: "iana"
    },
    "application/vnd.informix-visionary": {
      source: "iana"
    },
    "application/vnd.infotech.project": {
      source: "iana"
    },
    "application/vnd.infotech.project+xml": {
      source: "iana"
    },
    "application/vnd.innopath.wamp.notification": {
      source: "iana"
    },
    "application/vnd.insors.igm": {
      source: "iana",
      extensions: ["igm"]
    },
    "application/vnd.intercon.formnet": {
      source: "iana",
      extensions: ["xpw", "xpx"]
    },
    "application/vnd.intergeo": {
      source: "iana",
      extensions: ["i2g"]
    },
    "application/vnd.intertrust.digibox": {
      source: "iana"
    },
    "application/vnd.intertrust.nncp": {
      source: "iana"
    },
    "application/vnd.intu.qbo": {
      source: "iana",
      extensions: ["qbo"]
    },
    "application/vnd.intu.qfx": {
      source: "iana",
      extensions: ["qfx"]
    },
    "application/vnd.iptc.g2.catalogitem+xml": {
      source: "iana"
    },
    "application/vnd.iptc.g2.conceptitem+xml": {
      source: "iana"
    },
    "application/vnd.iptc.g2.knowledgeitem+xml": {
      source: "iana"
    },
    "application/vnd.iptc.g2.newsitem+xml": {
      source: "iana"
    },
    "application/vnd.iptc.g2.newsmessage+xml": {
      source: "iana"
    },
    "application/vnd.iptc.g2.packageitem+xml": {
      source: "iana"
    },
    "application/vnd.iptc.g2.planningitem+xml": {
      source: "iana"
    },
    "application/vnd.ipunplugged.rcprofile": {
      source: "iana",
      extensions: ["rcprofile"]
    },
    "application/vnd.irepository.package+xml": {
      source: "iana",
      extensions: ["irp"]
    },
    "application/vnd.is-xpr": {
      source: "iana",
      extensions: ["xpr"]
    },
    "application/vnd.isac.fcs": {
      source: "iana",
      extensions: ["fcs"]
    },
    "application/vnd.jam": {
      source: "iana",
      extensions: ["jam"]
    },
    "application/vnd.japannet-directory-service": {
      source: "iana"
    },
    "application/vnd.japannet-jpnstore-wakeup": {
      source: "iana"
    },
    "application/vnd.japannet-payment-wakeup": {
      source: "iana"
    },
    "application/vnd.japannet-registration": {
      source: "iana"
    },
    "application/vnd.japannet-registration-wakeup": {
      source: "iana"
    },
    "application/vnd.japannet-setstore-wakeup": {
      source: "iana"
    },
    "application/vnd.japannet-verification": {
      source: "iana"
    },
    "application/vnd.japannet-verification-wakeup": {
      source: "iana"
    },
    "application/vnd.jcp.javame.midlet-rms": {
      source: "iana",
      extensions: ["rms"]
    },
    "application/vnd.jisp": {
      source: "iana",
      extensions: ["jisp"]
    },
    "application/vnd.joost.joda-archive": {
      source: "iana",
      extensions: ["joda"]
    },
    "application/vnd.jsk.isdn-ngn": {
      source: "iana"
    },
    "application/vnd.kahootz": {
      source: "iana",
      extensions: ["ktz", "ktr"]
    },
    "application/vnd.kde.karbon": {
      source: "iana",
      extensions: ["karbon"]
    },
    "application/vnd.kde.kchart": {
      source: "iana",
      extensions: ["chrt"]
    },
    "application/vnd.kde.kformula": {
      source: "iana",
      extensions: ["kfo"]
    },
    "application/vnd.kde.kivio": {
      source: "iana",
      extensions: ["flw"]
    },
    "application/vnd.kde.kontour": {
      source: "iana",
      extensions: ["kon"]
    },
    "application/vnd.kde.kpresenter": {
      source: "iana",
      extensions: ["kpr", "kpt"]
    },
    "application/vnd.kde.kspread": {
      source: "iana",
      extensions: ["ksp"]
    },
    "application/vnd.kde.kword": {
      source: "iana",
      extensions: ["kwd", "kwt"]
    },
    "application/vnd.kenameaapp": {
      source: "iana",
      extensions: ["htke"]
    },
    "application/vnd.kidspiration": {
      source: "iana",
      extensions: ["kia"]
    },
    "application/vnd.kinar": {
      source: "iana",
      extensions: ["kne", "knp"]
    },
    "application/vnd.koan": {
      source: "iana",
      extensions: ["skp", "skd", "skt", "skm"]
    },
    "application/vnd.kodak-descriptor": {
      source: "iana",
      extensions: ["sse"]
    },
    "application/vnd.las.las+xml": {
      source: "iana",
      extensions: ["lasxml"]
    },
    "application/vnd.liberty-request+xml": {
      source: "iana"
    },
    "application/vnd.llamagraphics.life-balance.desktop": {
      source: "iana",
      extensions: ["lbd"]
    },
    "application/vnd.llamagraphics.life-balance.exchange+xml": {
      source: "iana",
      extensions: ["lbe"]
    },
    "application/vnd.lotus-1-2-3": {
      source: "iana",
      extensions: ["123"]
    },
    "application/vnd.lotus-approach": {
      source: "iana",
      extensions: ["apr"]
    },
    "application/vnd.lotus-freelance": {
      source: "iana",
      extensions: ["pre"]
    },
    "application/vnd.lotus-notes": {
      source: "iana",
      extensions: ["nsf"]
    },
    "application/vnd.lotus-organizer": {
      source: "iana",
      extensions: ["org"]
    },
    "application/vnd.lotus-screencam": {
      source: "iana",
      extensions: ["scm"]
    },
    "application/vnd.lotus-wordpro": {
      source: "iana",
      extensions: ["lwp"]
    },
    "application/vnd.macports.portpkg": {
      source: "iana",
      extensions: ["portpkg"]
    },
    "application/vnd.mapbox-vector-tile": {
      source: "iana"
    },
    "application/vnd.marlin.drm.actiontoken+xml": {
      source: "iana"
    },
    "application/vnd.marlin.drm.conftoken+xml": {
      source: "iana"
    },
    "application/vnd.marlin.drm.license+xml": {
      source: "iana"
    },
    "application/vnd.marlin.drm.mdcf": {
      source: "iana"
    },
    "application/vnd.mason+json": {
      source: "iana",
      compressible: true
    },
    "application/vnd.maxmind.maxmind-db": {
      source: "iana"
    },
    "application/vnd.mcd": {
      source: "iana",
      extensions: ["mcd"]
    },
    "application/vnd.medcalcdata": {
      source: "iana",
      extensions: ["mc1"]
    },
    "application/vnd.mediastation.cdkey": {
      source: "iana",
      extensions: ["cdkey"]
    },
    "application/vnd.meridian-slingshot": {
      source: "iana"
    },
    "application/vnd.mfer": {
      source: "iana",
      extensions: ["mwf"]
    },
    "application/vnd.mfmp": {
      source: "iana",
      extensions: ["mfm"]
    },
    "application/vnd.micro+json": {
      source: "iana",
      compressible: true
    },
    "application/vnd.micrografx.flo": {
      source: "iana",
      extensions: ["flo"]
    },
    "application/vnd.micrografx.igx": {
      source: "iana",
      extensions: ["igx"]
    },
    "application/vnd.microsoft.portable-executable": {
      source: "iana"
    },
    "application/vnd.miele+json": {
      source: "iana",
      compressible: true
    },
    "application/vnd.mif": {
      source: "iana",
      extensions: ["mif"]
    },
    "application/vnd.minisoft-hp3000-save": {
      source: "iana"
    },
    "application/vnd.mitsubishi.misty-guard.trustweb": {
      source: "iana"
    },
    "application/vnd.mobius.daf": {
      source: "iana",
      extensions: ["daf"]
    },
    "application/vnd.mobius.dis": {
      source: "iana",
      extensions: ["dis"]
    },
    "application/vnd.mobius.mbk": {
      source: "iana",
      extensions: ["mbk"]
    },
    "application/vnd.mobius.mqy": {
      source: "iana",
      extensions: ["mqy"]
    },
    "application/vnd.mobius.msl": {
      source: "iana",
      extensions: ["msl"]
    },
    "application/vnd.mobius.plc": {
      source: "iana",
      extensions: ["plc"]
    },
    "application/vnd.mobius.txf": {
      source: "iana",
      extensions: ["txf"]
    },
    "application/vnd.mophun.application": {
      source: "iana",
      extensions: ["mpn"]
    },
    "application/vnd.mophun.certificate": {
      source: "iana",
      extensions: ["mpc"]
    },
    "application/vnd.motorola.flexsuite": {
      source: "iana"
    },
    "application/vnd.motorola.flexsuite.adsi": {
      source: "iana"
    },
    "application/vnd.motorola.flexsuite.fis": {
      source: "iana"
    },
    "application/vnd.motorola.flexsuite.gotap": {
      source: "iana"
    },
    "application/vnd.motorola.flexsuite.kmr": {
      source: "iana"
    },
    "application/vnd.motorola.flexsuite.ttc": {
      source: "iana"
    },
    "application/vnd.motorola.flexsuite.wem": {
      source: "iana"
    },
    "application/vnd.motorola.iprm": {
      source: "iana"
    },
    "application/vnd.mozilla.xul+xml": {
      source: "iana",
      compressible: true,
      extensions: ["xul"]
    },
    "application/vnd.ms-3mfdocument": {
      source: "iana"
    },
    "application/vnd.ms-artgalry": {
      source: "iana",
      extensions: ["cil"]
    },
    "application/vnd.ms-asf": {
      source: "iana"
    },
    "application/vnd.ms-cab-compressed": {
      source: "iana",
      extensions: ["cab"]
    },
    "application/vnd.ms-color.iccprofile": {
      source: "apache"
    },
    "application/vnd.ms-excel": {
      source: "iana",
      compressible: false,
      extensions: ["xls", "xlm", "xla", "xlc", "xlt", "xlw"]
    },
    "application/vnd.ms-excel.addin.macroenabled.12": {
      source: "iana",
      extensions: ["xlam"]
    },
    "application/vnd.ms-excel.sheet.binary.macroenabled.12": {
      source: "iana",
      extensions: ["xlsb"]
    },
    "application/vnd.ms-excel.sheet.macroenabled.12": {
      source: "iana",
      extensions: ["xlsm"]
    },
    "application/vnd.ms-excel.template.macroenabled.12": {
      source: "iana",
      extensions: ["xltm"]
    },
    "application/vnd.ms-fontobject": {
      source: "iana",
      compressible: true,
      extensions: ["eot"]
    },
    "application/vnd.ms-htmlhelp": {
      source: "iana",
      extensions: ["chm"]
    },
    "application/vnd.ms-ims": {
      source: "iana",
      extensions: ["ims"]
    },
    "application/vnd.ms-lrm": {
      source: "iana",
      extensions: ["lrm"]
    },
    "application/vnd.ms-office.activex+xml": {
      source: "iana"
    },
    "application/vnd.ms-officetheme": {
      source: "iana",
      extensions: ["thmx"]
    },
    "application/vnd.ms-opentype": {
      source: "apache",
      compressible: true
    },
    "application/vnd.ms-package.obfuscated-opentype": {
      source: "apache"
    },
    "application/vnd.ms-pki.seccat": {
      source: "apache",
      extensions: ["cat"]
    },
    "application/vnd.ms-pki.stl": {
      source: "apache",
      extensions: ["stl"]
    },
    "application/vnd.ms-playready.initiator+xml": {
      source: "iana"
    },
    "application/vnd.ms-powerpoint": {
      source: "iana",
      compressible: false,
      extensions: ["ppt", "pps", "pot"]
    },
    "application/vnd.ms-powerpoint.addin.macroenabled.12": {
      source: "iana",
      extensions: ["ppam"]
    },
    "application/vnd.ms-powerpoint.presentation.macroenabled.12": {
      source: "iana",
      extensions: ["pptm"]
    },
    "application/vnd.ms-powerpoint.slide.macroenabled.12": {
      source: "iana",
      extensions: ["sldm"]
    },
    "application/vnd.ms-powerpoint.slideshow.macroenabled.12": {
      source: "iana",
      extensions: ["ppsm"]
    },
    "application/vnd.ms-powerpoint.template.macroenabled.12": {
      source: "iana",
      extensions: ["potm"]
    },
    "application/vnd.ms-printdevicecapabilities+xml": {
      source: "iana"
    },
    "application/vnd.ms-printing.printticket+xml": {
      source: "apache"
    },
    "application/vnd.ms-printschematicket+xml": {
      source: "iana"
    },
    "application/vnd.ms-project": {
      source: "iana",
      extensions: ["mpp", "mpt"]
    },
    "application/vnd.ms-tnef": {
      source: "iana"
    },
    "application/vnd.ms-windows.devicepairing": {
      source: "iana"
    },
    "application/vnd.ms-windows.nwprinting.oob": {
      source: "iana"
    },
    "application/vnd.ms-windows.printerpairing": {
      source: "iana"
    },
    "application/vnd.ms-windows.wsd.oob": {
      source: "iana"
    },
    "application/vnd.ms-wmdrm.lic-chlg-req": {
      source: "iana"
    },
    "application/vnd.ms-wmdrm.lic-resp": {
      source: "iana"
    },
    "application/vnd.ms-wmdrm.meter-chlg-req": {
      source: "iana"
    },
    "application/vnd.ms-wmdrm.meter-resp": {
      source: "iana"
    },
    "application/vnd.ms-word.document.macroenabled.12": {
      source: "iana",
      extensions: ["docm"]
    },
    "application/vnd.ms-word.template.macroenabled.12": {
      source: "iana",
      extensions: ["dotm"]
    },
    "application/vnd.ms-works": {
      source: "iana",
      extensions: ["wps", "wks", "wcm", "wdb"]
    },
    "application/vnd.ms-wpl": {
      source: "iana",
      extensions: ["wpl"]
    },
    "application/vnd.ms-xpsdocument": {
      source: "iana",
      compressible: false,
      extensions: ["xps"]
    },
    "application/vnd.msa-disk-image": {
      source: "iana"
    },
    "application/vnd.mseq": {
      source: "iana",
      extensions: ["mseq"]
    },
    "application/vnd.msign": {
      source: "iana"
    },
    "application/vnd.multiad.creator": {
      source: "iana"
    },
    "application/vnd.multiad.creator.cif": {
      source: "iana"
    },
    "application/vnd.music-niff": {
      source: "iana"
    },
    "application/vnd.musician": {
      source: "iana",
      extensions: ["mus"]
    },
    "application/vnd.muvee.style": {
      source: "iana",
      extensions: ["msty"]
    },
    "application/vnd.mynfc": {
      source: "iana",
      extensions: ["taglet"]
    },
    "application/vnd.ncd.control": {
      source: "iana"
    },
    "application/vnd.ncd.reference": {
      source: "iana"
    },
    "application/vnd.nearst.inv+json": {
      source: "iana",
      compressible: true
    },
    "application/vnd.nervana": {
      source: "iana"
    },
    "application/vnd.netfpx": {
      source: "iana"
    },
    "application/vnd.neurolanguage.nlu": {
      source: "iana",
      extensions: ["nlu"]
    },
    "application/vnd.nintendo.nitro.rom": {
      source: "iana"
    },
    "application/vnd.nintendo.snes.rom": {
      source: "iana"
    },
    "application/vnd.nitf": {
      source: "iana",
      extensions: ["ntf", "nitf"]
    },
    "application/vnd.noblenet-directory": {
      source: "iana",
      extensions: ["nnd"]
    },
    "application/vnd.noblenet-sealer": {
      source: "iana",
      extensions: ["nns"]
    },
    "application/vnd.noblenet-web": {
      source: "iana",
      extensions: ["nnw"]
    },
    "application/vnd.nokia.catalogs": {
      source: "iana"
    },
    "application/vnd.nokia.conml+wbxml": {
      source: "iana"
    },
    "application/vnd.nokia.conml+xml": {
      source: "iana"
    },
    "application/vnd.nokia.iptv.config+xml": {
      source: "iana"
    },
    "application/vnd.nokia.isds-radio-presets": {
      source: "iana"
    },
    "application/vnd.nokia.landmark+wbxml": {
      source: "iana"
    },
    "application/vnd.nokia.landmark+xml": {
      source: "iana"
    },
    "application/vnd.nokia.landmarkcollection+xml": {
      source: "iana"
    },
    "application/vnd.nokia.n-gage.ac+xml": {
      source: "iana"
    },
    "application/vnd.nokia.n-gage.data": {
      source: "iana",
      extensions: ["ngdat"]
    },
    "application/vnd.nokia.n-gage.symbian.install": {
      source: "iana",
      extensions: ["n-gage"]
    },
    "application/vnd.nokia.ncd": {
      source: "iana"
    },
    "application/vnd.nokia.pcd+wbxml": {
      source: "iana"
    },
    "application/vnd.nokia.pcd+xml": {
      source: "iana"
    },
    "application/vnd.nokia.radio-preset": {
      source: "iana",
      extensions: ["rpst"]
    },
    "application/vnd.nokia.radio-presets": {
      source: "iana",
      extensions: ["rpss"]
    },
    "application/vnd.novadigm.edm": {
      source: "iana",
      extensions: ["edm"]
    },
    "application/vnd.novadigm.edx": {
      source: "iana",
      extensions: ["edx"]
    },
    "application/vnd.novadigm.ext": {
      source: "iana",
      extensions: ["ext"]
    },
    "application/vnd.ntt-local.content-share": {
      source: "iana"
    },
    "application/vnd.ntt-local.file-transfer": {
      source: "iana"
    },
    "application/vnd.ntt-local.ogw_remote-access": {
      source: "iana"
    },
    "application/vnd.ntt-local.sip-ta_remote": {
      source: "iana"
    },
    "application/vnd.ntt-local.sip-ta_tcp_stream": {
      source: "iana"
    },
    "application/vnd.oasis.opendocument.chart": {
      source: "iana",
      extensions: ["odc"]
    },
    "application/vnd.oasis.opendocument.chart-template": {
      source: "iana",
      extensions: ["otc"]
    },
    "application/vnd.oasis.opendocument.database": {
      source: "iana",
      extensions: ["odb"]
    },
    "application/vnd.oasis.opendocument.formula": {
      source: "iana",
      extensions: ["odf"]
    },
    "application/vnd.oasis.opendocument.formula-template": {
      source: "iana",
      extensions: ["odft"]
    },
    "application/vnd.oasis.opendocument.graphics": {
      source: "iana",
      compressible: false,
      extensions: ["odg"]
    },
    "application/vnd.oasis.opendocument.graphics-template": {
      source: "iana",
      extensions: ["otg"]
    },
    "application/vnd.oasis.opendocument.image": {
      source: "iana",
      extensions: ["odi"]
    },
    "application/vnd.oasis.opendocument.image-template": {
      source: "iana",
      extensions: ["oti"]
    },
    "application/vnd.oasis.opendocument.presentation": {
      source: "iana",
      compressible: false,
      extensions: ["odp"]
    },
    "application/vnd.oasis.opendocument.presentation-template": {
      source: "iana",
      extensions: ["otp"]
    },
    "application/vnd.oasis.opendocument.spreadsheet": {
      source: "iana",
      compressible: false,
      extensions: ["ods"]
    },
    "application/vnd.oasis.opendocument.spreadsheet-template": {
      source: "iana",
      extensions: ["ots"]
    },
    "application/vnd.oasis.opendocument.text": {
      source: "iana",
      compressible: false,
      extensions: ["odt"]
    },
    "application/vnd.oasis.opendocument.text-master": {
      source: "iana",
      extensions: ["odm"]
    },
    "application/vnd.oasis.opendocument.text-template": {
      source: "iana",
      extensions: ["ott"]
    },
    "application/vnd.oasis.opendocument.text-web": {
      source: "iana",
      extensions: ["oth"]
    },
    "application/vnd.obn": {
      source: "iana"
    },
    "application/vnd.oftn.l10n+json": {
      source: "iana",
      compressible: true
    },
    "application/vnd.oipf.contentaccessdownload+xml": {
      source: "iana"
    },
    "application/vnd.oipf.contentaccessstreaming+xml": {
      source: "iana"
    },
    "application/vnd.oipf.cspg-hexbinary": {
      source: "iana"
    },
    "application/vnd.oipf.dae.svg+xml": {
      source: "iana"
    },
    "application/vnd.oipf.dae.xhtml+xml": {
      source: "iana"
    },
    "application/vnd.oipf.mippvcontrolmessage+xml": {
      source: "iana"
    },
    "application/vnd.oipf.pae.gem": {
      source: "iana"
    },
    "application/vnd.oipf.spdiscovery+xml": {
      source: "iana"
    },
    "application/vnd.oipf.spdlist+xml": {
      source: "iana"
    },
    "application/vnd.oipf.ueprofile+xml": {
      source: "iana"
    },
    "application/vnd.oipf.userprofile+xml": {
      source: "iana"
    },
    "application/vnd.olpc-sugar": {
      source: "iana",
      extensions: ["xo"]
    },
    "application/vnd.oma-scws-config": {
      source: "iana"
    },
    "application/vnd.oma-scws-http-request": {
      source: "iana"
    },
    "application/vnd.oma-scws-http-response": {
      source: "iana"
    },
    "application/vnd.oma.bcast.associated-procedure-parameter+xml": {
      source: "iana"
    },
    "application/vnd.oma.bcast.drm-trigger+xml": {
      source: "iana"
    },
    "application/vnd.oma.bcast.imd+xml": {
      source: "iana"
    },
    "application/vnd.oma.bcast.ltkm": {
      source: "iana"
    },
    "application/vnd.oma.bcast.notification+xml": {
      source: "iana"
    },
    "application/vnd.oma.bcast.provisioningtrigger": {
      source: "iana"
    },
    "application/vnd.oma.bcast.sgboot": {
      source: "iana"
    },
    "application/vnd.oma.bcast.sgdd+xml": {
      source: "iana"
    },
    "application/vnd.oma.bcast.sgdu": {
      source: "iana"
    },
    "application/vnd.oma.bcast.simple-symbol-container": {
      source: "iana"
    },
    "application/vnd.oma.bcast.smartcard-trigger+xml": {
      source: "iana"
    },
    "application/vnd.oma.bcast.sprov+xml": {
      source: "iana"
    },
    "application/vnd.oma.bcast.stkm": {
      source: "iana"
    },
    "application/vnd.oma.cab-address-book+xml": {
      source: "iana"
    },
    "application/vnd.oma.cab-feature-handler+xml": {
      source: "iana"
    },
    "application/vnd.oma.cab-pcc+xml": {
      source: "iana"
    },
    "application/vnd.oma.cab-subs-invite+xml": {
      source: "iana"
    },
    "application/vnd.oma.cab-user-prefs+xml": {
      source: "iana"
    },
    "application/vnd.oma.dcd": {
      source: "iana"
    },
    "application/vnd.oma.dcdc": {
      source: "iana"
    },
    "application/vnd.oma.dd2+xml": {
      source: "iana",
      extensions: ["dd2"]
    },
    "application/vnd.oma.drm.risd+xml": {
      source: "iana"
    },
    "application/vnd.oma.group-usage-list+xml": {
      source: "iana"
    },
    "application/vnd.oma.lwm2m+json": {
      source: "iana",
      compressible: true
    },
    "application/vnd.oma.lwm2m+tlv": {
      source: "iana"
    },
    "application/vnd.oma.pal+xml": {
      source: "iana"
    },
    "application/vnd.oma.poc.detailed-progress-report+xml": {
      source: "iana"
    },
    "application/vnd.oma.poc.final-report+xml": {
      source: "iana"
    },
    "application/vnd.oma.poc.groups+xml": {
      source: "iana"
    },
    "application/vnd.oma.poc.invocation-descriptor+xml": {
      source: "iana"
    },
    "application/vnd.oma.poc.optimized-progress-report+xml": {
      source: "iana"
    },
    "application/vnd.oma.push": {
      source: "iana"
    },
    "application/vnd.oma.scidm.messages+xml": {
      source: "iana"
    },
    "application/vnd.oma.xcap-directory+xml": {
      source: "iana"
    },
    "application/vnd.omads-email+xml": {
      source: "iana"
    },
    "application/vnd.omads-file+xml": {
      source: "iana"
    },
    "application/vnd.omads-folder+xml": {
      source: "iana"
    },
    "application/vnd.omaloc-supl-init": {
      source: "iana"
    },
    "application/vnd.onepager": {
      source: "iana"
    },
    "application/vnd.openblox.game+xml": {
      source: "iana"
    },
    "application/vnd.openblox.game-binary": {
      source: "iana"
    },
    "application/vnd.openeye.oeb": {
      source: "iana"
    },
    "application/vnd.openofficeorg.extension": {
      source: "apache",
      extensions: ["oxt"]
    },
    "application/vnd.openstreetmap.data+xml": {
      source: "iana"
    },
    "application/vnd.openxmlformats-officedocument.custom-properties+xml": {
      source: "iana"
    },
    "application/vnd.openxmlformats-officedocument.customxmlproperties+xml": {
      source: "iana"
    },
    "application/vnd.openxmlformats-officedocument.drawing+xml": {
      source: "iana"
    },
    "application/vnd.openxmlformats-officedocument.drawingml.chart+xml": {
      source: "iana"
    },
    "application/vnd.openxmlformats-officedocument.drawingml.chartshapes+xml": {
      source: "iana"
    },
    "application/vnd.openxmlformats-officedocument.drawingml.diagramcolors+xml": {
      source: "iana"
    },
    "application/vnd.openxmlformats-officedocument.drawingml.diagramdata+xml": {
      source: "iana"
    },
    "application/vnd.openxmlformats-officedocument.drawingml.diagramlayout+xml": {
      source: "iana"
    },
    "application/vnd.openxmlformats-officedocument.drawingml.diagramstyle+xml": {
      source: "iana"
    },
    "application/vnd.openxmlformats-officedocument.extended-properties+xml": {
      source: "iana"
    },
    "application/vnd.openxmlformats-officedocument.presentationml-template": {
      source: "iana"
    },
    "application/vnd.openxmlformats-officedocument.presentationml.commentauthors+xml": {
      source: "iana"
    },
    "application/vnd.openxmlformats-officedocument.presentationml.comments+xml": {
      source: "iana"
    },
    "application/vnd.openxmlformats-officedocument.presentationml.handoutmaster+xml": {
      source: "iana"
    },
    "application/vnd.openxmlformats-officedocument.presentationml.notesmaster+xml": {
      source: "iana"
    },
    "application/vnd.openxmlformats-officedocument.presentationml.notesslide+xml": {
      source: "iana"
    },
    "application/vnd.openxmlformats-officedocument.presentationml.presentation": {
      source: "iana",
      compressible: false,
      extensions: ["pptx"]
    },
    "application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml": {
      source: "iana"
    },
    "application/vnd.openxmlformats-officedocument.presentationml.presprops+xml": {
      source: "iana"
    },
    "application/vnd.openxmlformats-officedocument.presentationml.slide": {
      source: "iana",
      extensions: ["sldx"]
    },
    "application/vnd.openxmlformats-officedocument.presentationml.slide+xml": {
      source: "iana"
    },
    "application/vnd.openxmlformats-officedocument.presentationml.slidelayout+xml": {
      source: "iana"
    },
    "application/vnd.openxmlformats-officedocument.presentationml.slidemaster+xml": {
      source: "iana"
    },
    "application/vnd.openxmlformats-officedocument.presentationml.slideshow": {
      source: "iana",
      extensions: ["ppsx"]
    },
    "application/vnd.openxmlformats-officedocument.presentationml.slideshow.main+xml": {
      source: "iana"
    },
    "application/vnd.openxmlformats-officedocument.presentationml.slideupdateinfo+xml": {
      source: "iana"
    },
    "application/vnd.openxmlformats-officedocument.presentationml.tablestyles+xml": {
      source: "iana"
    },
    "application/vnd.openxmlformats-officedocument.presentationml.tags+xml": {
      source: "iana"
    },
    "application/vnd.openxmlformats-officedocument.presentationml.template": {
      source: "apache",
      extensions: ["potx"]
    },
    "application/vnd.openxmlformats-officedocument.presentationml.template.main+xml": {
      source: "iana"
    },
    "application/vnd.openxmlformats-officedocument.presentationml.viewprops+xml": {
      source: "iana"
    },
    "application/vnd.openxmlformats-officedocument.spreadsheetml-template": {
      source: "iana"
    },
    "application/vnd.openxmlformats-officedocument.spreadsheetml.calcchain+xml": {
      source: "iana"
    },
    "application/vnd.openxmlformats-officedocument.spreadsheetml.chartsheet+xml": {
      source: "iana"
    },
    "application/vnd.openxmlformats-officedocument.spreadsheetml.comments+xml": {
      source: "iana"
    },
    "application/vnd.openxmlformats-officedocument.spreadsheetml.connections+xml": {
      source: "iana"
    },
    "application/vnd.openxmlformats-officedocument.spreadsheetml.dialogsheet+xml": {
      source: "iana"
    },
    "application/vnd.openxmlformats-officedocument.spreadsheetml.externallink+xml": {
      source: "iana"
    },
    "application/vnd.openxmlformats-officedocument.spreadsheetml.pivotcachedefinition+xml": {
      source: "iana"
    },
    "application/vnd.openxmlformats-officedocument.spreadsheetml.pivotcacherecords+xml": {
      source: "iana"
    },
    "application/vnd.openxmlformats-officedocument.spreadsheetml.pivottable+xml": {
      source: "iana"
    },
    "application/vnd.openxmlformats-officedocument.spreadsheetml.querytable+xml": {
      source: "iana"
    },
    "application/vnd.openxmlformats-officedocument.spreadsheetml.revisionheaders+xml": {
      source: "iana"
    },
    "application/vnd.openxmlformats-officedocument.spreadsheetml.revisionlog+xml": {
      source: "iana"
    },
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sharedstrings+xml": {
      source: "iana"
    },
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": {
      source: "iana",
      compressible: false,
      extensions: ["xlsx"]
    },
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml": {
      source: "iana"
    },
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheetmetadata+xml": {
      source: "iana"
    },
    "application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml": {
      source: "iana"
    },
    "application/vnd.openxmlformats-officedocument.spreadsheetml.table+xml": {
      source: "iana"
    },
    "application/vnd.openxmlformats-officedocument.spreadsheetml.tablesinglecells+xml": {
      source: "iana"
    },
    "application/vnd.openxmlformats-officedocument.spreadsheetml.template": {
      source: "apache",
      extensions: ["xltx"]
    },
    "application/vnd.openxmlformats-officedocument.spreadsheetml.template.main+xml": {
      source: "iana"
    },
    "application/vnd.openxmlformats-officedocument.spreadsheetml.usernames+xml": {
      source: "iana"
    },
    "application/vnd.openxmlformats-officedocument.spreadsheetml.volatiledependencies+xml": {
      source: "iana"
    },
    "application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml": {
      source: "iana"
    },
    "application/vnd.openxmlformats-officedocument.theme+xml": {
      source: "iana"
    },
    "application/vnd.openxmlformats-officedocument.themeoverride+xml": {
      source: "iana"
    },
    "application/vnd.openxmlformats-officedocument.vmldrawing": {
      source: "iana"
    },
    "application/vnd.openxmlformats-officedocument.wordprocessingml-template": {
      source: "iana"
    },
    "application/vnd.openxmlformats-officedocument.wordprocessingml.comments+xml": {
      source: "iana"
    },
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": {
      source: "iana",
      compressible: false,
      extensions: ["docx"]
    },
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document.glossary+xml": {
      source: "iana"
    },
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml": {
      source: "iana"
    },
    "application/vnd.openxmlformats-officedocument.wordprocessingml.endnotes+xml": {
      source: "iana"
    },
    "application/vnd.openxmlformats-officedocument.wordprocessingml.fonttable+xml": {
      source: "iana"
    },
    "application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml": {
      source: "iana"
    },
    "application/vnd.openxmlformats-officedocument.wordprocessingml.footnotes+xml": {
      source: "iana"
    },
    "application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml": {
      source: "iana"
    },
    "application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml": {
      source: "iana"
    },
    "application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml": {
      source: "iana"
    },
    "application/vnd.openxmlformats-officedocument.wordprocessingml.template": {
      source: "apache",
      extensions: ["dotx"]
    },
    "application/vnd.openxmlformats-officedocument.wordprocessingml.template.main+xml": {
      source: "iana"
    },
    "application/vnd.openxmlformats-officedocument.wordprocessingml.websettings+xml": {
      source: "iana"
    },
    "application/vnd.openxmlformats-package.core-properties+xml": {
      source: "iana"
    },
    "application/vnd.openxmlformats-package.digital-signature-xmlsignature+xml": {
      source: "iana"
    },
    "application/vnd.openxmlformats-package.relationships+xml": {
      source: "iana"
    },
    "application/vnd.oracle.resource+json": {
      source: "iana",
      compressible: true
    },
    "application/vnd.orange.indata": {
      source: "iana"
    },
    "application/vnd.osa.netdeploy": {
      source: "iana"
    },
    "application/vnd.osgeo.mapguide.package": {
      source: "iana",
      extensions: ["mgp"]
    },
    "application/vnd.osgi.bundle": {
      source: "iana"
    },
    "application/vnd.osgi.dp": {
      source: "iana",
      extensions: ["dp"]
    },
    "application/vnd.osgi.subsystem": {
      source: "iana",
      extensions: ["esa"]
    },
    "application/vnd.otps.ct-kip+xml": {
      source: "iana"
    },
    "application/vnd.oxli.countgraph": {
      source: "iana"
    },
    "application/vnd.pagerduty+json": {
      source: "iana",
      compressible: true
    },
    "application/vnd.palm": {
      source: "iana",
      extensions: ["pdb", "pqa", "oprc"]
    },
    "application/vnd.panoply": {
      source: "iana"
    },
    "application/vnd.paos+xml": {
      source: "iana"
    },
    "application/vnd.paos.xml": {
      source: "apache"
    },
    "application/vnd.pawaafile": {
      source: "iana",
      extensions: ["paw"]
    },
    "application/vnd.pcos": {
      source: "iana"
    },
    "application/vnd.pg.format": {
      source: "iana",
      extensions: ["str"]
    },
    "application/vnd.pg.osasli": {
      source: "iana",
      extensions: ["ei6"]
    },
    "application/vnd.piaccess.application-licence": {
      source: "iana"
    },
    "application/vnd.picsel": {
      source: "iana",
      extensions: ["efif"]
    },
    "application/vnd.pmi.widget": {
      source: "iana",
      extensions: ["wg"]
    },
    "application/vnd.poc.group-advertisement+xml": {
      source: "iana"
    },
    "application/vnd.pocketlearn": {
      source: "iana",
      extensions: ["plf"]
    },
    "application/vnd.powerbuilder6": {
      source: "iana",
      extensions: ["pbd"]
    },
    "application/vnd.powerbuilder6-s": {
      source: "iana"
    },
    "application/vnd.powerbuilder7": {
      source: "iana"
    },
    "application/vnd.powerbuilder7-s": {
      source: "iana"
    },
    "application/vnd.powerbuilder75": {
      source: "iana"
    },
    "application/vnd.powerbuilder75-s": {
      source: "iana"
    },
    "application/vnd.preminet": {
      source: "iana"
    },
    "application/vnd.previewsystems.box": {
      source: "iana",
      extensions: ["box"]
    },
    "application/vnd.proteus.magazine": {
      source: "iana",
      extensions: ["mgz"]
    },
    "application/vnd.publishare-delta-tree": {
      source: "iana",
      extensions: ["qps"]
    },
    "application/vnd.pvi.ptid1": {
      source: "iana",
      extensions: ["ptid"]
    },
    "application/vnd.pwg-multiplexed": {
      source: "iana"
    },
    "application/vnd.pwg-xhtml-print+xml": {
      source: "iana"
    },
    "application/vnd.qualcomm.brew-app-res": {
      source: "iana"
    },
    "application/vnd.quarantainenet": {
      source: "iana"
    },
    "application/vnd.quark.quarkxpress": {
      source: "iana",
      extensions: ["qxd", "qxt", "qwd", "qwt", "qxl", "qxb"]
    },
    "application/vnd.quobject-quoxdocument": {
      source: "iana"
    },
    "application/vnd.radisys.moml+xml": {
      source: "iana"
    },
    "application/vnd.radisys.msml+xml": {
      source: "iana"
    },
    "application/vnd.radisys.msml-audit+xml": {
      source: "iana"
    },
    "application/vnd.radisys.msml-audit-conf+xml": {
      source: "iana"
    },
    "application/vnd.radisys.msml-audit-conn+xml": {
      source: "iana"
    },
    "application/vnd.radisys.msml-audit-dialog+xml": {
      source: "iana"
    },
    "application/vnd.radisys.msml-audit-stream+xml": {
      source: "iana"
    },
    "application/vnd.radisys.msml-conf+xml": {
      source: "iana"
    },
    "application/vnd.radisys.msml-dialog+xml": {
      source: "iana"
    },
    "application/vnd.radisys.msml-dialog-base+xml": {
      source: "iana"
    },
    "application/vnd.radisys.msml-dialog-fax-detect+xml": {
      source: "iana"
    },
    "application/vnd.radisys.msml-dialog-fax-sendrecv+xml": {
      source: "iana"
    },
    "application/vnd.radisys.msml-dialog-group+xml": {
      source: "iana"
    },
    "application/vnd.radisys.msml-dialog-speech+xml": {
      source: "iana"
    },
    "application/vnd.radisys.msml-dialog-transform+xml": {
      source: "iana"
    },
    "application/vnd.rainstor.data": {
      source: "iana"
    },
    "application/vnd.rapid": {
      source: "iana"
    },
    "application/vnd.rar": {
      source: "iana"
    },
    "application/vnd.realvnc.bed": {
      source: "iana",
      extensions: ["bed"]
    },
    "application/vnd.recordare.musicxml": {
      source: "iana",
      extensions: ["mxl"]
    },
    "application/vnd.recordare.musicxml+xml": {
      source: "iana",
      extensions: ["musicxml"]
    },
    "application/vnd.renlearn.rlprint": {
      source: "iana"
    },
    "application/vnd.rig.cryptonote": {
      source: "iana",
      extensions: ["cryptonote"]
    },
    "application/vnd.rim.cod": {
      source: "apache",
      extensions: ["cod"]
    },
    "application/vnd.rn-realmedia": {
      source: "apache",
      extensions: ["rm"]
    },
    "application/vnd.rn-realmedia-vbr": {
      source: "apache",
      extensions: ["rmvb"]
    },
    "application/vnd.route66.link66+xml": {
      source: "iana",
      extensions: ["link66"]
    },
    "application/vnd.rs-274x": {
      source: "iana"
    },
    "application/vnd.ruckus.download": {
      source: "iana"
    },
    "application/vnd.s3sms": {
      source: "iana"
    },
    "application/vnd.sailingtracker.track": {
      source: "iana",
      extensions: ["st"]
    },
    "application/vnd.sbm.cid": {
      source: "iana"
    },
    "application/vnd.sbm.mid2": {
      source: "iana"
    },
    "application/vnd.scribus": {
      source: "iana"
    },
    "application/vnd.sealed.3df": {
      source: "iana"
    },
    "application/vnd.sealed.csf": {
      source: "iana"
    },
    "application/vnd.sealed.doc": {
      source: "iana"
    },
    "application/vnd.sealed.eml": {
      source: "iana"
    },
    "application/vnd.sealed.mht": {
      source: "iana"
    },
    "application/vnd.sealed.net": {
      source: "iana"
    },
    "application/vnd.sealed.ppt": {
      source: "iana"
    },
    "application/vnd.sealed.tiff": {
      source: "iana"
    },
    "application/vnd.sealed.xls": {
      source: "iana"
    },
    "application/vnd.sealedmedia.softseal.html": {
      source: "iana"
    },
    "application/vnd.sealedmedia.softseal.pdf": {
      source: "iana"
    },
    "application/vnd.seemail": {
      source: "iana",
      extensions: ["see"]
    },
    "application/vnd.sema": {
      source: "iana",
      extensions: ["sema"]
    },
    "application/vnd.semd": {
      source: "iana",
      extensions: ["semd"]
    },
    "application/vnd.semf": {
      source: "iana",
      extensions: ["semf"]
    },
    "application/vnd.shana.informed.formdata": {
      source: "iana",
      extensions: ["ifm"]
    },
    "application/vnd.shana.informed.formtemplate": {
      source: "iana",
      extensions: ["itp"]
    },
    "application/vnd.shana.informed.interchange": {
      source: "iana",
      extensions: ["iif"]
    },
    "application/vnd.shana.informed.package": {
      source: "iana",
      extensions: ["ipk"]
    },
    "application/vnd.simtech-mindmapper": {
      source: "iana",
      extensions: ["twd", "twds"]
    },
    "application/vnd.siren+json": {
      source: "iana",
      compressible: true
    },
    "application/vnd.smaf": {
      source: "iana",
      extensions: ["mmf"]
    },
    "application/vnd.smart.notebook": {
      source: "iana"
    },
    "application/vnd.smart.teacher": {
      source: "iana",
      extensions: ["teacher"]
    },
    "application/vnd.software602.filler.form+xml": {
      source: "iana"
    },
    "application/vnd.software602.filler.form-xml-zip": {
      source: "iana"
    },
    "application/vnd.solent.sdkm+xml": {
      source: "iana",
      extensions: ["sdkm", "sdkd"]
    },
    "application/vnd.spotfire.dxp": {
      source: "iana",
      extensions: ["dxp"]
    },
    "application/vnd.spotfire.sfs": {
      source: "iana",
      extensions: ["sfs"]
    },
    "application/vnd.sss-cod": {
      source: "iana"
    },
    "application/vnd.sss-dtf": {
      source: "iana"
    },
    "application/vnd.sss-ntf": {
      source: "iana"
    },
    "application/vnd.stardivision.calc": {
      source: "apache",
      extensions: ["sdc"]
    },
    "application/vnd.stardivision.draw": {
      source: "apache",
      extensions: ["sda"]
    },
    "application/vnd.stardivision.impress": {
      source: "apache",
      extensions: ["sdd"]
    },
    "application/vnd.stardivision.math": {
      source: "apache",
      extensions: ["smf"]
    },
    "application/vnd.stardivision.writer": {
      source: "apache",
      extensions: ["sdw", "vor"]
    },
    "application/vnd.stardivision.writer-global": {
      source: "apache",
      extensions: ["sgl"]
    },
    "application/vnd.stepmania.package": {
      source: "iana",
      extensions: ["smzip"]
    },
    "application/vnd.stepmania.stepchart": {
      source: "iana",
      extensions: ["sm"]
    },
    "application/vnd.street-stream": {
      source: "iana"
    },
    "application/vnd.sun.wadl+xml": {
      source: "iana"
    },
    "application/vnd.sun.xml.calc": {
      source: "apache",
      extensions: ["sxc"]
    },
    "application/vnd.sun.xml.calc.template": {
      source: "apache",
      extensions: ["stc"]
    },
    "application/vnd.sun.xml.draw": {
      source: "apache",
      extensions: ["sxd"]
    },
    "application/vnd.sun.xml.draw.template": {
      source: "apache",
      extensions: ["std"]
    },
    "application/vnd.sun.xml.impress": {
      source: "apache",
      extensions: ["sxi"]
    },
    "application/vnd.sun.xml.impress.template": {
      source: "apache",
      extensions: ["sti"]
    },
    "application/vnd.sun.xml.math": {
      source: "apache",
      extensions: ["sxm"]
    },
    "application/vnd.sun.xml.writer": {
      source: "apache",
      extensions: ["sxw"]
    },
    "application/vnd.sun.xml.writer.global": {
      source: "apache",
      extensions: ["sxg"]
    },
    "application/vnd.sun.xml.writer.template": {
      source: "apache",
      extensions: ["stw"]
    },
    "application/vnd.sus-calendar": {
      source: "iana",
      extensions: ["sus", "susp"]
    },
    "application/vnd.svd": {
      source: "iana",
      extensions: ["svd"]
    },
    "application/vnd.swiftview-ics": {
      source: "iana"
    },
    "application/vnd.symbian.install": {
      source: "apache",
      extensions: ["sis", "sisx"]
    },
    "application/vnd.syncml+xml": {
      source: "iana",
      extensions: ["xsm"]
    },
    "application/vnd.syncml.dm+wbxml": {
      source: "iana",
      extensions: ["bdm"]
    },
    "application/vnd.syncml.dm+xml": {
      source: "iana",
      extensions: ["xdm"]
    },
    "application/vnd.syncml.dm.notification": {
      source: "iana"
    },
    "application/vnd.syncml.dmddf+wbxml": {
      source: "iana"
    },
    "application/vnd.syncml.dmddf+xml": {
      source: "iana"
    },
    "application/vnd.syncml.dmtnds+wbxml": {
      source: "iana"
    },
    "application/vnd.syncml.dmtnds+xml": {
      source: "iana"
    },
    "application/vnd.syncml.ds.notification": {
      source: "iana"
    },
    "application/vnd.tao.intent-module-archive": {
      source: "iana",
      extensions: ["tao"]
    },
    "application/vnd.tcpdump.pcap": {
      source: "iana",
      extensions: ["pcap", "cap", "dmp"]
    },
    "application/vnd.tmd.mediaflex.api+xml": {
      source: "iana"
    },
    "application/vnd.tml": {
      source: "iana"
    },
    "application/vnd.tmobile-livetv": {
      source: "iana",
      extensions: ["tmo"]
    },
    "application/vnd.tri.onesource": {
      source: "iana"
    },
    "application/vnd.trid.tpt": {
      source: "iana",
      extensions: ["tpt"]
    },
    "application/vnd.triscape.mxs": {
      source: "iana",
      extensions: ["mxs"]
    },
    "application/vnd.trueapp": {
      source: "iana",
      extensions: ["tra"]
    },
    "application/vnd.truedoc": {
      source: "iana"
    },
    "application/vnd.ubisoft.webplayer": {
      source: "iana"
    },
    "application/vnd.ufdl": {
      source: "iana",
      extensions: ["ufd", "ufdl"]
    },
    "application/vnd.uiq.theme": {
      source: "iana",
      extensions: ["utz"]
    },
    "application/vnd.umajin": {
      source: "iana",
      extensions: ["umj"]
    },
    "application/vnd.unity": {
      source: "iana",
      extensions: ["unityweb"]
    },
    "application/vnd.uoml+xml": {
      source: "iana",
      extensions: ["uoml"]
    },
    "application/vnd.uplanet.alert": {
      source: "iana"
    },
    "application/vnd.uplanet.alert-wbxml": {
      source: "iana"
    },
    "application/vnd.uplanet.bearer-choice": {
      source: "iana"
    },
    "application/vnd.uplanet.bearer-choice-wbxml": {
      source: "iana"
    },
    "application/vnd.uplanet.cacheop": {
      source: "iana"
    },
    "application/vnd.uplanet.cacheop-wbxml": {
      source: "iana"
    },
    "application/vnd.uplanet.channel": {
      source: "iana"
    },
    "application/vnd.uplanet.channel-wbxml": {
      source: "iana"
    },
    "application/vnd.uplanet.list": {
      source: "iana"
    },
    "application/vnd.uplanet.list-wbxml": {
      source: "iana"
    },
    "application/vnd.uplanet.listcmd": {
      source: "iana"
    },
    "application/vnd.uplanet.listcmd-wbxml": {
      source: "iana"
    },
    "application/vnd.uplanet.signal": {
      source: "iana"
    },
    "application/vnd.uri-map": {
      source: "iana"
    },
    "application/vnd.valve.source.material": {
      source: "iana"
    },
    "application/vnd.vcx": {
      source: "iana",
      extensions: ["vcx"]
    },
    "application/vnd.vd-study": {
      source: "iana"
    },
    "application/vnd.vectorworks": {
      source: "iana"
    },
    "application/vnd.vel+json": {
      source: "iana",
      compressible: true
    },
    "application/vnd.verimatrix.vcas": {
      source: "iana"
    },
    "application/vnd.vidsoft.vidconference": {
      source: "iana"
    },
    "application/vnd.visio": {
      source: "iana",
      extensions: ["vsd", "vst", "vss", "vsw"]
    },
    "application/vnd.visionary": {
      source: "iana",
      extensions: ["vis"]
    },
    "application/vnd.vividence.scriptfile": {
      source: "iana"
    },
    "application/vnd.vsf": {
      source: "iana",
      extensions: ["vsf"]
    },
    "application/vnd.wap.sic": {
      source: "iana"
    },
    "application/vnd.wap.slc": {
      source: "iana"
    },
    "application/vnd.wap.wbxml": {
      source: "iana",
      extensions: ["wbxml"]
    },
    "application/vnd.wap.wmlc": {
      source: "iana",
      extensions: ["wmlc"]
    },
    "application/vnd.wap.wmlscriptc": {
      source: "iana",
      extensions: ["wmlsc"]
    },
    "application/vnd.webturbo": {
      source: "iana",
      extensions: ["wtb"]
    },
    "application/vnd.wfa.p2p": {
      source: "iana"
    },
    "application/vnd.wfa.wsc": {
      source: "iana"
    },
    "application/vnd.windows.devicepairing": {
      source: "iana"
    },
    "application/vnd.wmc": {
      source: "iana"
    },
    "application/vnd.wmf.bootstrap": {
      source: "iana"
    },
    "application/vnd.wolfram.mathematica": {
      source: "iana"
    },
    "application/vnd.wolfram.mathematica.package": {
      source: "iana"
    },
    "application/vnd.wolfram.player": {
      source: "iana",
      extensions: ["nbp"]
    },
    "application/vnd.wordperfect": {
      source: "iana",
      extensions: ["wpd"]
    },
    "application/vnd.wqd": {
      source: "iana",
      extensions: ["wqd"]
    },
    "application/vnd.wrq-hp3000-labelled": {
      source: "iana"
    },
    "application/vnd.wt.stf": {
      source: "iana",
      extensions: ["stf"]
    },
    "application/vnd.wv.csp+wbxml": {
      source: "iana"
    },
    "application/vnd.wv.csp+xml": {
      source: "iana"
    },
    "application/vnd.wv.ssp+xml": {
      source: "iana"
    },
    "application/vnd.xacml+json": {
      source: "iana",
      compressible: true
    },
    "application/vnd.xara": {
      source: "iana",
      extensions: ["xar"]
    },
    "application/vnd.xfdl": {
      source: "iana",
      extensions: ["xfdl"]
    },
    "application/vnd.xfdl.webform": {
      source: "iana"
    },
    "application/vnd.xmi+xml": {
      source: "iana"
    },
    "application/vnd.xmpie.cpkg": {
      source: "iana"
    },
    "application/vnd.xmpie.dpkg": {
      source: "iana"
    },
    "application/vnd.xmpie.plan": {
      source: "iana"
    },
    "application/vnd.xmpie.ppkg": {
      source: "iana"
    },
    "application/vnd.xmpie.xlim": {
      source: "iana"
    },
    "application/vnd.yamaha.hv-dic": {
      source: "iana",
      extensions: ["hvd"]
    },
    "application/vnd.yamaha.hv-script": {
      source: "iana",
      extensions: ["hvs"]
    },
    "application/vnd.yamaha.hv-voice": {
      source: "iana",
      extensions: ["hvp"]
    },
    "application/vnd.yamaha.openscoreformat": {
      source: "iana",
      extensions: ["osf"]
    },
    "application/vnd.yamaha.openscoreformat.osfpvg+xml": {
      source: "iana",
      extensions: ["osfpvg"]
    },
    "application/vnd.yamaha.remote-setup": {
      source: "iana"
    },
    "application/vnd.yamaha.smaf-audio": {
      source: "iana",
      extensions: ["saf"]
    },
    "application/vnd.yamaha.smaf-phrase": {
      source: "iana",
      extensions: ["spf"]
    },
    "application/vnd.yamaha.through-ngn": {
      source: "iana"
    },
    "application/vnd.yamaha.tunnel-udpencap": {
      source: "iana"
    },
    "application/vnd.yaoweme": {
      source: "iana"
    },
    "application/vnd.yellowriver-custom-menu": {
      source: "iana",
      extensions: ["cmp"]
    },
    "application/vnd.zul": {
      source: "iana",
      extensions: ["zir", "zirz"]
    },
    "application/vnd.zzazz.deck+xml": {
      source: "iana",
      extensions: ["zaz"]
    },
    "application/voicexml+xml": {
      source: "iana",
      extensions: ["vxml"]
    },
    "application/vq-rtcpxr": {
      source: "iana"
    },
    "application/watcherinfo+xml": {
      source: "iana"
    },
    "application/whoispp-query": {
      source: "iana"
    },
    "application/whoispp-response": {
      source: "iana"
    },
    "application/widget": {
      source: "iana",
      extensions: ["wgt"]
    },
    "application/winhlp": {
      source: "apache",
      extensions: ["hlp"]
    },
    "application/wita": {
      source: "iana"
    },
    "application/wordperfect5.1": {
      source: "iana"
    },
    "application/wsdl+xml": {
      source: "iana",
      extensions: ["wsdl"]
    },
    "application/wspolicy+xml": {
      source: "iana",
      extensions: ["wspolicy"]
    },
    "application/x-7z-compressed": {
      source: "apache",
      compressible: false,
      extensions: ["7z"]
    },
    "application/x-abiword": {
      source: "apache",
      extensions: ["abw"]
    },
    "application/x-ace-compressed": {
      source: "apache",
      extensions: ["ace"]
    },
    "application/x-amf": {
      source: "apache"
    },
    "application/x-apple-diskimage": {
      source: "apache",
      extensions: ["dmg"]
    },
    "application/x-authorware-bin": {
      source: "apache",
      extensions: ["aab", "x32", "u32", "vox"]
    },
    "application/x-authorware-map": {
      source: "apache",
      extensions: ["aam"]
    },
    "application/x-authorware-seg": {
      source: "apache",
      extensions: ["aas"]
    },
    "application/x-bcpio": {
      source: "apache",
      extensions: ["bcpio"]
    },
    "application/x-bdoc": {
      compressible: false,
      extensions: ["bdoc"]
    },
    "application/x-bittorrent": {
      source: "apache",
      extensions: ["torrent"]
    },
    "application/x-blorb": {
      source: "apache",
      extensions: ["blb", "blorb"]
    },
    "application/x-bzip": {
      source: "apache",
      compressible: false,
      extensions: ["bz"]
    },
    "application/x-bzip2": {
      source: "apache",
      compressible: false,
      extensions: ["bz2", "boz"]
    },
    "application/x-cbr": {
      source: "apache",
      extensions: ["cbr", "cba", "cbt", "cbz", "cb7"]
    },
    "application/x-cdlink": {
      source: "apache",
      extensions: ["vcd"]
    },
    "application/x-cfs-compressed": {
      source: "apache",
      extensions: ["cfs"]
    },
    "application/x-chat": {
      source: "apache",
      extensions: ["chat"]
    },
    "application/x-chess-pgn": {
      source: "apache",
      extensions: ["pgn"]
    },
    "application/x-chrome-extension": {
      extensions: ["crx"]
    },
    "application/x-cocoa": {
      source: "nginx",
      extensions: ["cco"]
    },
    "application/x-compress": {
      source: "apache"
    },
    "application/x-conference": {
      source: "apache",
      extensions: ["nsc"]
    },
    "application/x-cpio": {
      source: "apache",
      extensions: ["cpio"]
    },
    "application/x-csh": {
      source: "apache",
      extensions: ["csh"]
    },
    "application/x-deb": {
      compressible: false
    },
    "application/x-debian-package": {
      source: "apache",
      extensions: ["deb", "udeb"]
    },
    "application/x-dgc-compressed": {
      source: "apache",
      extensions: ["dgc"]
    },
    "application/x-director": {
      source: "apache",
      extensions: ["dir", "dcr", "dxr", "cst", "cct", "cxt", "w3d", "fgd", "swa"]
    },
    "application/x-doom": {
      source: "apache",
      extensions: ["wad"]
    },
    "application/x-dtbncx+xml": {
      source: "apache",
      extensions: ["ncx"]
    },
    "application/x-dtbook+xml": {
      source: "apache",
      extensions: ["dtb"]
    },
    "application/x-dtbresource+xml": {
      source: "apache",
      extensions: ["res"]
    },
    "application/x-dvi": {
      source: "apache",
      compressible: false,
      extensions: ["dvi"]
    },
    "application/x-envoy": {
      source: "apache",
      extensions: ["evy"]
    },
    "application/x-eva": {
      source: "apache",
      extensions: ["eva"]
    },
    "application/x-font-bdf": {
      source: "apache",
      extensions: ["bdf"]
    },
    "application/x-font-dos": {
      source: "apache"
    },
    "application/x-font-framemaker": {
      source: "apache"
    },
    "application/x-font-ghostscript": {
      source: "apache",
      extensions: ["gsf"]
    },
    "application/x-font-libgrx": {
      source: "apache"
    },
    "application/x-font-linux-psf": {
      source: "apache",
      extensions: ["psf"]
    },
    "application/x-font-otf": {
      source: "apache",
      compressible: true,
      extensions: ["otf"]
    },
    "application/x-font-pcf": {
      source: "apache",
      extensions: ["pcf"]
    },
    "application/x-font-snf": {
      source: "apache",
      extensions: ["snf"]
    },
    "application/x-font-speedo": {
      source: "apache"
    },
    "application/x-font-sunos-news": {
      source: "apache"
    },
    "application/x-font-ttf": {
      source: "apache",
      compressible: true,
      extensions: ["ttf", "ttc"]
    },
    "application/x-font-type1": {
      source: "apache",
      extensions: ["pfa", "pfb", "pfm", "afm"]
    },
    "application/x-font-vfont": {
      source: "apache"
    },
    "application/x-freearc": {
      source: "apache",
      extensions: ["arc"]
    },
    "application/x-futuresplash": {
      source: "apache",
      extensions: ["spl"]
    },
    "application/x-gca-compressed": {
      source: "apache",
      extensions: ["gca"]
    },
    "application/x-glulx": {
      source: "apache",
      extensions: ["ulx"]
    },
    "application/x-gnumeric": {
      source: "apache",
      extensions: ["gnumeric"]
    },
    "application/x-gramps-xml": {
      source: "apache",
      extensions: ["gramps"]
    },
    "application/x-gtar": {
      source: "apache",
      extensions: ["gtar"]
    },
    "application/x-gzip": {
      source: "apache"
    },
    "application/x-hdf": {
      source: "apache",
      extensions: ["hdf"]
    },
    "application/x-httpd-php": {
      compressible: true,
      extensions: ["php"]
    },
    "application/x-install-instructions": {
      source: "apache",
      extensions: ["install"]
    },
    "application/x-iso9660-image": {
      source: "apache",
      extensions: ["iso"]
    },
    "application/x-java-archive-diff": {
      source: "nginx",
      extensions: ["jardiff"]
    },
    "application/x-java-jnlp-file": {
      source: "apache",
      compressible: false,
      extensions: ["jnlp"]
    },
    "application/x-javascript": {
      compressible: true
    },
    "application/x-latex": {
      source: "apache",
      compressible: false,
      extensions: ["latex"]
    },
    "application/x-lua-bytecode": {
      extensions: ["luac"]
    },
    "application/x-lzh-compressed": {
      source: "apache",
      extensions: ["lzh", "lha"]
    },
    "application/x-makeself": {
      source: "nginx",
      extensions: ["run"]
    },
    "application/x-mie": {
      source: "apache",
      extensions: ["mie"]
    },
    "application/x-mobipocket-ebook": {
      source: "apache",
      extensions: ["prc", "mobi"]
    },
    "application/x-mpegurl": {
      compressible: false
    },
    "application/x-ms-application": {
      source: "apache",
      extensions: ["application"]
    },
    "application/x-ms-shortcut": {
      source: "apache",
      extensions: ["lnk"]
    },
    "application/x-ms-wmd": {
      source: "apache",
      extensions: ["wmd"]
    },
    "application/x-ms-wmz": {
      source: "apache",
      extensions: ["wmz"]
    },
    "application/x-ms-xbap": {
      source: "apache",
      extensions: ["xbap"]
    },
    "application/x-msaccess": {
      source: "apache",
      extensions: ["mdb"]
    },
    "application/x-msbinder": {
      source: "apache",
      extensions: ["obd"]
    },
    "application/x-mscardfile": {
      source: "apache",
      extensions: ["crd"]
    },
    "application/x-msclip": {
      source: "apache",
      extensions: ["clp"]
    },
    "application/x-msdos-program": {
      extensions: ["exe"]
    },
    "application/x-msdownload": {
      source: "apache",
      extensions: ["exe", "dll", "com", "bat", "msi"]
    },
    "application/x-msmediaview": {
      source: "apache",
      extensions: ["mvb", "m13", "m14"]
    },
    "application/x-msmetafile": {
      source: "apache",
      extensions: ["wmf", "wmz", "emf", "emz"]
    },
    "application/x-msmoney": {
      source: "apache",
      extensions: ["mny"]
    },
    "application/x-mspublisher": {
      source: "apache",
      extensions: ["pub"]
    },
    "application/x-msschedule": {
      source: "apache",
      extensions: ["scd"]
    },
    "application/x-msterminal": {
      source: "apache",
      extensions: ["trm"]
    },
    "application/x-mswrite": {
      source: "apache",
      extensions: ["wri"]
    },
    "application/x-netcdf": {
      source: "apache",
      extensions: ["nc", "cdf"]
    },
    "application/x-ns-proxy-autoconfig": {
      compressible: true,
      extensions: ["pac"]
    },
    "application/x-nzb": {
      source: "apache",
      extensions: ["nzb"]
    },
    "application/x-perl": {
      source: "nginx",
      extensions: ["pl", "pm"]
    },
    "application/x-pilot": {
      source: "nginx",
      extensions: ["prc", "pdb"]
    },
    "application/x-pkcs12": {
      source: "apache",
      compressible: false,
      extensions: ["p12", "pfx"]
    },
    "application/x-pkcs7-certificates": {
      source: "apache",
      extensions: ["p7b", "spc"]
    },
    "application/x-pkcs7-certreqresp": {
      source: "apache",
      extensions: ["p7r"]
    },
    "application/x-rar-compressed": {
      source: "apache",
      compressible: false,
      extensions: ["rar"]
    },
    "application/x-redhat-package-manager": {
      source: "nginx",
      extensions: ["rpm"]
    },
    "application/x-research-info-systems": {
      source: "apache",
      extensions: ["ris"]
    },
    "application/x-sea": {
      source: "nginx",
      extensions: ["sea"]
    },
    "application/x-sh": {
      source: "apache",
      compressible: true,
      extensions: ["sh"]
    },
    "application/x-shar": {
      source: "apache",
      extensions: ["shar"]
    },
    "application/x-shockwave-flash": {
      source: "apache",
      compressible: false,
      extensions: ["swf"]
    },
    "application/x-silverlight-app": {
      source: "apache",
      extensions: ["xap"]
    },
    "application/x-sql": {
      source: "apache",
      extensions: ["sql"]
    },
    "application/x-stuffit": {
      source: "apache",
      compressible: false,
      extensions: ["sit"]
    },
    "application/x-stuffitx": {
      source: "apache",
      extensions: ["sitx"]
    },
    "application/x-subrip": {
      source: "apache",
      extensions: ["srt"]
    },
    "application/x-sv4cpio": {
      source: "apache",
      extensions: ["sv4cpio"]
    },
    "application/x-sv4crc": {
      source: "apache",
      extensions: ["sv4crc"]
    },
    "application/x-t3vm-image": {
      source: "apache",
      extensions: ["t3"]
    },
    "application/x-tads": {
      source: "apache",
      extensions: ["gam"]
    },
    "application/x-tar": {
      source: "apache",
      compressible: true,
      extensions: ["tar"]
    },
    "application/x-tcl": {
      source: "apache",
      extensions: ["tcl", "tk"]
    },
    "application/x-tex": {
      source: "apache",
      extensions: ["tex"]
    },
    "application/x-tex-tfm": {
      source: "apache",
      extensions: ["tfm"]
    },
    "application/x-texinfo": {
      source: "apache",
      extensions: ["texinfo", "texi"]
    },
    "application/x-tgif": {
      source: "apache",
      extensions: ["obj"]
    },
    "application/x-ustar": {
      source: "apache",
      extensions: ["ustar"]
    },
    "application/x-wais-source": {
      source: "apache",
      extensions: ["src"]
    },
    "application/x-web-app-manifest+json": {
      compressible: true,
      extensions: ["webapp"]
    },
    "application/x-www-form-urlencoded": {
      source: "iana",
      compressible: true
    },
    "application/x-x509-ca-cert": {
      source: "apache",
      extensions: ["der", "crt", "pem"]
    },
    "application/x-xfig": {
      source: "apache",
      extensions: ["fig"]
    },
    "application/x-xliff+xml": {
      source: "apache",
      extensions: ["xlf"]
    },
    "application/x-xpinstall": {
      source: "apache",
      compressible: false,
      extensions: ["xpi"]
    },
    "application/x-xz": {
      source: "apache",
      extensions: ["xz"]
    },
    "application/x-zmachine": {
      source: "apache",
      extensions: ["z1", "z2", "z3", "z4", "z5", "z6", "z7", "z8"]
    },
    "application/x400-bp": {
      source: "iana"
    },
    "application/xacml+xml": {
      source: "iana"
    },
    "application/xaml+xml": {
      source: "apache",
      extensions: ["xaml"]
    },
    "application/xcap-att+xml": {
      source: "iana"
    },
    "application/xcap-caps+xml": {
      source: "iana"
    },
    "application/xcap-diff+xml": {
      source: "iana",
      extensions: ["xdf"]
    },
    "application/xcap-el+xml": {
      source: "iana"
    },
    "application/xcap-error+xml": {
      source: "iana"
    },
    "application/xcap-ns+xml": {
      source: "iana"
    },
    "application/xcon-conference-info+xml": {
      source: "iana"
    },
    "application/xcon-conference-info-diff+xml": {
      source: "iana"
    },
    "application/xenc+xml": {
      source: "iana",
      extensions: ["xenc"]
    },
    "application/xhtml+xml": {
      source: "iana",
      compressible: true,
      extensions: ["xhtml", "xht"]
    },
    "application/xhtml-voice+xml": {
      source: "apache"
    },
    "application/xml": {
      source: "iana",
      compressible: true,
      extensions: ["xml", "xsl", "xsd", "rng"]
    },
    "application/xml-dtd": {
      source: "iana",
      compressible: true,
      extensions: ["dtd"]
    },
    "application/xml-external-parsed-entity": {
      source: "iana"
    },
    "application/xml-patch+xml": {
      source: "iana"
    },
    "application/xmpp+xml": {
      source: "iana"
    },
    "application/xop+xml": {
      source: "iana",
      compressible: true,
      extensions: ["xop"]
    },
    "application/xproc+xml": {
      source: "apache",
      extensions: ["xpl"]
    },
    "application/xslt+xml": {
      source: "iana",
      extensions: ["xslt"]
    },
    "application/xspf+xml": {
      source: "apache",
      extensions: ["xspf"]
    },
    "application/xv+xml": {
      source: "iana",
      extensions: ["mxml", "xhvml", "xvml", "xvm"]
    },
    "application/yang": {
      source: "iana",
      extensions: ["yang"]
    },
    "application/yang-data+json": {
      source: "iana",
      compressible: true
    },
    "application/yang-data+xml": {
      source: "iana"
    },
    "application/yin+xml": {
      source: "iana",
      extensions: ["yin"]
    },
    "application/zip": {
      source: "iana",
      compressible: false,
      extensions: ["zip"]
    },
    "application/zlib": {
      source: "iana"
    },
    "audio/1d-interleaved-parityfec": {
      source: "iana"
    },
    "audio/32kadpcm": {
      source: "iana"
    },
    "audio/3gpp": {
      source: "iana",
      compressible: false,
      extensions: ["3gpp"]
    },
    "audio/3gpp2": {
      source: "iana"
    },
    "audio/ac3": {
      source: "iana"
    },
    "audio/adpcm": {
      source: "apache",
      extensions: ["adp"]
    },
    "audio/amr": {
      source: "iana"
    },
    "audio/amr-wb": {
      source: "iana"
    },
    "audio/amr-wb+": {
      source: "iana"
    },
    "audio/aptx": {
      source: "iana"
    },
    "audio/asc": {
      source: "iana"
    },
    "audio/atrac-advanced-lossless": {
      source: "iana"
    },
    "audio/atrac-x": {
      source: "iana"
    },
    "audio/atrac3": {
      source: "iana"
    },
    "audio/basic": {
      source: "iana",
      compressible: false,
      extensions: ["au", "snd"]
    },
    "audio/bv16": {
      source: "iana"
    },
    "audio/bv32": {
      source: "iana"
    },
    "audio/clearmode": {
      source: "iana"
    },
    "audio/cn": {
      source: "iana"
    },
    "audio/dat12": {
      source: "iana"
    },
    "audio/dls": {
      source: "iana"
    },
    "audio/dsr-es201108": {
      source: "iana"
    },
    "audio/dsr-es202050": {
      source: "iana"
    },
    "audio/dsr-es202211": {
      source: "iana"
    },
    "audio/dsr-es202212": {
      source: "iana"
    },
    "audio/dv": {
      source: "iana"
    },
    "audio/dvi4": {
      source: "iana"
    },
    "audio/eac3": {
      source: "iana"
    },
    "audio/encaprtp": {
      source: "iana"
    },
    "audio/evrc": {
      source: "iana"
    },
    "audio/evrc-qcp": {
      source: "iana"
    },
    "audio/evrc0": {
      source: "iana"
    },
    "audio/evrc1": {
      source: "iana"
    },
    "audio/evrcb": {
      source: "iana"
    },
    "audio/evrcb0": {
      source: "iana"
    },
    "audio/evrcb1": {
      source: "iana"
    },
    "audio/evrcnw": {
      source: "iana"
    },
    "audio/evrcnw0": {
      source: "iana"
    },
    "audio/evrcnw1": {
      source: "iana"
    },
    "audio/evrcwb": {
      source: "iana"
    },
    "audio/evrcwb0": {
      source: "iana"
    },
    "audio/evrcwb1": {
      source: "iana"
    },
    "audio/evs": {
      source: "iana"
    },
    "audio/fwdred": {
      source: "iana"
    },
    "audio/g711-0": {
      source: "iana"
    },
    "audio/g719": {
      source: "iana"
    },
    "audio/g722": {
      source: "iana"
    },
    "audio/g7221": {
      source: "iana"
    },
    "audio/g723": {
      source: "iana"
    },
    "audio/g726-16": {
      source: "iana"
    },
    "audio/g726-24": {
      source: "iana"
    },
    "audio/g726-32": {
      source: "iana"
    },
    "audio/g726-40": {
      source: "iana"
    },
    "audio/g728": {
      source: "iana"
    },
    "audio/g729": {
      source: "iana"
    },
    "audio/g7291": {
      source: "iana"
    },
    "audio/g729d": {
      source: "iana"
    },
    "audio/g729e": {
      source: "iana"
    },
    "audio/gsm": {
      source: "iana"
    },
    "audio/gsm-efr": {
      source: "iana"
    },
    "audio/gsm-hr-08": {
      source: "iana"
    },
    "audio/ilbc": {
      source: "iana"
    },
    "audio/ip-mr_v2.5": {
      source: "iana"
    },
    "audio/isac": {
      source: "apache"
    },
    "audio/l16": {
      source: "iana"
    },
    "audio/l20": {
      source: "iana"
    },
    "audio/l24": {
      source: "iana",
      compressible: false
    },
    "audio/l8": {
      source: "iana"
    },
    "audio/lpc": {
      source: "iana"
    },
    "audio/midi": {
      source: "apache",
      extensions: ["mid", "midi", "kar", "rmi"]
    },
    "audio/mobile-xmf": {
      source: "iana"
    },
    "audio/mp3": {
      compressible: false,
      extensions: ["mp3"]
    },
    "audio/mp4": {
      source: "iana",
      compressible: false,
      extensions: ["m4a", "mp4a"]
    },
    "audio/mp4a-latm": {
      source: "iana"
    },
    "audio/mpa": {
      source: "iana"
    },
    "audio/mpa-robust": {
      source: "iana"
    },
    "audio/mpeg": {
      source: "iana",
      compressible: false,
      extensions: ["mpga", "mp2", "mp2a", "mp3", "m2a", "m3a"]
    },
    "audio/mpeg4-generic": {
      source: "iana"
    },
    "audio/musepack": {
      source: "apache"
    },
    "audio/ogg": {
      source: "iana",
      compressible: false,
      extensions: ["oga", "ogg", "spx"]
    },
    "audio/opus": {
      source: "iana"
    },
    "audio/parityfec": {
      source: "iana"
    },
    "audio/pcma": {
      source: "iana"
    },
    "audio/pcma-wb": {
      source: "iana"
    },
    "audio/pcmu": {
      source: "iana"
    },
    "audio/pcmu-wb": {
      source: "iana"
    },
    "audio/prs.sid": {
      source: "iana"
    },
    "audio/qcelp": {
      source: "iana"
    },
    "audio/raptorfec": {
      source: "iana"
    },
    "audio/red": {
      source: "iana"
    },
    "audio/rtp-enc-aescm128": {
      source: "iana"
    },
    "audio/rtp-midi": {
      source: "iana"
    },
    "audio/rtploopback": {
      source: "iana"
    },
    "audio/rtx": {
      source: "iana"
    },
    "audio/s3m": {
      source: "apache",
      extensions: ["s3m"]
    },
    "audio/silk": {
      source: "apache",
      extensions: ["sil"]
    },
    "audio/smv": {
      source: "iana"
    },
    "audio/smv-qcp": {
      source: "iana"
    },
    "audio/smv0": {
      source: "iana"
    },
    "audio/sp-midi": {
      source: "iana"
    },
    "audio/speex": {
      source: "iana"
    },
    "audio/t140c": {
      source: "iana"
    },
    "audio/t38": {
      source: "iana"
    },
    "audio/telephone-event": {
      source: "iana"
    },
    "audio/tone": {
      source: "iana"
    },
    "audio/uemclip": {
      source: "iana"
    },
    "audio/ulpfec": {
      source: "iana"
    },
    "audio/vdvi": {
      source: "iana"
    },
    "audio/vmr-wb": {
      source: "iana"
    },
    "audio/vnd.3gpp.iufp": {
      source: "iana"
    },
    "audio/vnd.4sb": {
      source: "iana"
    },
    "audio/vnd.audiokoz": {
      source: "iana"
    },
    "audio/vnd.celp": {
      source: "iana"
    },
    "audio/vnd.cisco.nse": {
      source: "iana"
    },
    "audio/vnd.cmles.radio-events": {
      source: "iana"
    },
    "audio/vnd.cns.anp1": {
      source: "iana"
    },
    "audio/vnd.cns.inf1": {
      source: "iana"
    },
    "audio/vnd.dece.audio": {
      source: "iana",
      extensions: ["uva", "uvva"]
    },
    "audio/vnd.digital-winds": {
      source: "iana",
      extensions: ["eol"]
    },
    "audio/vnd.dlna.adts": {
      source: "iana"
    },
    "audio/vnd.dolby.heaac.1": {
      source: "iana"
    },
    "audio/vnd.dolby.heaac.2": {
      source: "iana"
    },
    "audio/vnd.dolby.mlp": {
      source: "iana"
    },
    "audio/vnd.dolby.mps": {
      source: "iana"
    },
    "audio/vnd.dolby.pl2": {
      source: "iana"
    },
    "audio/vnd.dolby.pl2x": {
      source: "iana"
    },
    "audio/vnd.dolby.pl2z": {
      source: "iana"
    },
    "audio/vnd.dolby.pulse.1": {
      source: "iana"
    },
    "audio/vnd.dra": {
      source: "iana",
      extensions: ["dra"]
    },
    "audio/vnd.dts": {
      source: "iana",
      extensions: ["dts"]
    },
    "audio/vnd.dts.hd": {
      source: "iana",
      extensions: ["dtshd"]
    },
    "audio/vnd.dvb.file": {
      source: "iana"
    },
    "audio/vnd.everad.plj": {
      source: "iana"
    },
    "audio/vnd.hns.audio": {
      source: "iana"
    },
    "audio/vnd.lucent.voice": {
      source: "iana",
      extensions: ["lvp"]
    },
    "audio/vnd.ms-playready.media.pya": {
      source: "iana",
      extensions: ["pya"]
    },
    "audio/vnd.nokia.mobile-xmf": {
      source: "iana"
    },
    "audio/vnd.nortel.vbk": {
      source: "iana"
    },
    "audio/vnd.nuera.ecelp4800": {
      source: "iana",
      extensions: ["ecelp4800"]
    },
    "audio/vnd.nuera.ecelp7470": {
      source: "iana",
      extensions: ["ecelp7470"]
    },
    "audio/vnd.nuera.ecelp9600": {
      source: "iana",
      extensions: ["ecelp9600"]
    },
    "audio/vnd.octel.sbc": {
      source: "iana"
    },
    "audio/vnd.qcelp": {
      source: "iana"
    },
    "audio/vnd.rhetorex.32kadpcm": {
      source: "iana"
    },
    "audio/vnd.rip": {
      source: "iana",
      extensions: ["rip"]
    },
    "audio/vnd.rn-realaudio": {
      compressible: false
    },
    "audio/vnd.sealedmedia.softseal.mpeg": {
      source: "iana"
    },
    "audio/vnd.vmx.cvsd": {
      source: "iana"
    },
    "audio/vnd.wave": {
      compressible: false
    },
    "audio/vorbis": {
      source: "iana",
      compressible: false
    },
    "audio/vorbis-config": {
      source: "iana"
    },
    "audio/wav": {
      compressible: false,
      extensions: ["wav"]
    },
    "audio/wave": {
      compressible: false,
      extensions: ["wav"]
    },
    "audio/webm": {
      source: "apache",
      compressible: false,
      extensions: ["weba"]
    },
    "audio/x-aac": {
      source: "apache",
      compressible: false,
      extensions: ["aac"]
    },
    "audio/x-aiff": {
      source: "apache",
      extensions: ["aif", "aiff", "aifc"]
    },
    "audio/x-caf": {
      source: "apache",
      compressible: false,
      extensions: ["caf"]
    },
    "audio/x-flac": {
      source: "apache",
      extensions: ["flac"]
    },
    "audio/x-m4a": {
      source: "nginx",
      extensions: ["m4a"]
    },
    "audio/x-matroska": {
      source: "apache",
      extensions: ["mka"]
    },
    "audio/x-mpegurl": {
      source: "apache",
      extensions: ["m3u"]
    },
    "audio/x-ms-wax": {
      source: "apache",
      extensions: ["wax"]
    },
    "audio/x-ms-wma": {
      source: "apache",
      extensions: ["wma"]
    },
    "audio/x-pn-realaudio": {
      source: "apache",
      extensions: ["ram", "ra"]
    },
    "audio/x-pn-realaudio-plugin": {
      source: "apache",
      extensions: ["rmp"]
    },
    "audio/x-realaudio": {
      source: "nginx",
      extensions: ["ra"]
    },
    "audio/x-tta": {
      source: "apache"
    },
    "audio/x-wav": {
      source: "apache",
      extensions: ["wav"]
    },
    "audio/xm": {
      source: "apache",
      extensions: ["xm"]
    },
    "chemical/x-cdx": {
      source: "apache",
      extensions: ["cdx"]
    },
    "chemical/x-cif": {
      source: "apache",
      extensions: ["cif"]
    },
    "chemical/x-cmdf": {
      source: "apache",
      extensions: ["cmdf"]
    },
    "chemical/x-cml": {
      source: "apache",
      extensions: ["cml"]
    },
    "chemical/x-csml": {
      source: "apache",
      extensions: ["csml"]
    },
    "chemical/x-pdb": {
      source: "apache"
    },
    "chemical/x-xyz": {
      source: "apache",
      extensions: ["xyz"]
    },
    "font/opentype": {
      compressible: true,
      extensions: ["otf"]
    },
    "image/bmp": {
      source: "iana",
      compressible: true,
      extensions: ["bmp"]
    },
    "image/cgm": {
      source: "iana",
      extensions: ["cgm"]
    },
    "image/dicom-rle": {
      source: "iana"
    },
    "image/emf": {
      source: "iana"
    },
    "image/fits": {
      source: "iana"
    },
    "image/g3fax": {
      source: "iana",
      extensions: ["g3"]
    },
    "image/gif": {
      source: "iana",
      compressible: false,
      extensions: ["gif"]
    },
    "image/ief": {
      source: "iana",
      extensions: ["ief"]
    },
    "image/jls": {
      source: "iana"
    },
    "image/jp2": {
      source: "iana"
    },
    "image/jpeg": {
      source: "iana",
      compressible: false,
      extensions: ["jpeg", "jpg", "jpe"]
    },
    "image/jpm": {
      source: "iana"
    },
    "image/jpx": {
      source: "iana"
    },
    "image/ktx": {
      source: "iana",
      extensions: ["ktx"]
    },
    "image/naplps": {
      source: "iana"
    },
    "image/pjpeg": {
      compressible: false
    },
    "image/png": {
      source: "iana",
      compressible: false,
      extensions: ["png"]
    },
    "image/prs.btif": {
      source: "iana",
      extensions: ["btif"]
    },
    "image/prs.pti": {
      source: "iana"
    },
    "image/pwg-raster": {
      source: "iana"
    },
    "image/sgi": {
      source: "apache",
      extensions: ["sgi"]
    },
    "image/svg+xml": {
      source: "iana",
      compressible: true,
      extensions: ["svg", "svgz"]
    },
    "image/t38": {
      source: "iana"
    },
    "image/tiff": {
      source: "iana",
      compressible: false,
      extensions: ["tiff", "tif"]
    },
    "image/tiff-fx": {
      source: "iana"
    },
    "image/vnd.adobe.photoshop": {
      source: "iana",
      compressible: true,
      extensions: ["psd"]
    },
    "image/vnd.airzip.accelerator.azv": {
      source: "iana"
    },
    "image/vnd.cns.inf2": {
      source: "iana"
    },
    "image/vnd.dece.graphic": {
      source: "iana",
      extensions: ["uvi", "uvvi", "uvg", "uvvg"]
    },
    "image/vnd.djvu": {
      source: "iana",
      extensions: ["djvu", "djv"]
    },
    "image/vnd.dvb.subtitle": {
      source: "iana",
      extensions: ["sub"]
    },
    "image/vnd.dwg": {
      source: "iana",
      extensions: ["dwg"]
    },
    "image/vnd.dxf": {
      source: "iana",
      extensions: ["dxf"]
    },
    "image/vnd.fastbidsheet": {
      source: "iana",
      extensions: ["fbs"]
    },
    "image/vnd.fpx": {
      source: "iana",
      extensions: ["fpx"]
    },
    "image/vnd.fst": {
      source: "iana",
      extensions: ["fst"]
    },
    "image/vnd.fujixerox.edmics-mmr": {
      source: "iana",
      extensions: ["mmr"]
    },
    "image/vnd.fujixerox.edmics-rlc": {
      source: "iana",
      extensions: ["rlc"]
    },
    "image/vnd.globalgraphics.pgb": {
      source: "iana"
    },
    "image/vnd.microsoft.icon": {
      source: "iana"
    },
    "image/vnd.mix": {
      source: "iana"
    },
    "image/vnd.mozilla.apng": {
      source: "iana"
    },
    "image/vnd.ms-modi": {
      source: "iana",
      extensions: ["mdi"]
    },
    "image/vnd.ms-photo": {
      source: "apache",
      extensions: ["wdp"]
    },
    "image/vnd.net-fpx": {
      source: "iana",
      extensions: ["npx"]
    },
    "image/vnd.radiance": {
      source: "iana"
    },
    "image/vnd.sealed.png": {
      source: "iana"
    },
    "image/vnd.sealedmedia.softseal.gif": {
      source: "iana"
    },
    "image/vnd.sealedmedia.softseal.jpg": {
      source: "iana"
    },
    "image/vnd.svf": {
      source: "iana"
    },
    "image/vnd.tencent.tap": {
      source: "iana"
    },
    "image/vnd.valve.source.texture": {
      source: "iana"
    },
    "image/vnd.wap.wbmp": {
      source: "iana",
      extensions: ["wbmp"]
    },
    "image/vnd.xiff": {
      source: "iana",
      extensions: ["xif"]
    },
    "image/vnd.zbrush.pcx": {
      source: "iana"
    },
    "image/webp": {
      source: "apache",
      extensions: ["webp"]
    },
    "image/wmf": {
      source: "iana"
    },
    "image/x-3ds": {
      source: "apache",
      extensions: ["3ds"]
    },
    "image/x-cmu-raster": {
      source: "apache",
      extensions: ["ras"]
    },
    "image/x-cmx": {
      source: "apache",
      extensions: ["cmx"]
    },
    "image/x-freehand": {
      source: "apache",
      extensions: ["fh", "fhc", "fh4", "fh5", "fh7"]
    },
    "image/x-icon": {
      source: "apache",
      compressible: true,
      extensions: ["ico"]
    },
    "image/x-jng": {
      source: "nginx",
      extensions: ["jng"]
    },
    "image/x-mrsid-image": {
      source: "apache",
      extensions: ["sid"]
    },
    "image/x-ms-bmp": {
      source: "nginx",
      compressible: true,
      extensions: ["bmp"]
    },
    "image/x-pcx": {
      source: "apache",
      extensions: ["pcx"]
    },
    "image/x-pict": {
      source: "apache",
      extensions: ["pic", "pct"]
    },
    "image/x-portable-anymap": {
      source: "apache",
      extensions: ["pnm"]
    },
    "image/x-portable-bitmap": {
      source: "apache",
      extensions: ["pbm"]
    },
    "image/x-portable-graymap": {
      source: "apache",
      extensions: ["pgm"]
    },
    "image/x-portable-pixmap": {
      source: "apache",
      extensions: ["ppm"]
    },
    "image/x-rgb": {
      source: "apache",
      extensions: ["rgb"]
    },
    "image/x-tga": {
      source: "apache",
      extensions: ["tga"]
    },
    "image/x-xbitmap": {
      source: "apache",
      extensions: ["xbm"]
    },
    "image/x-xcf": {
      compressible: false
    },
    "image/x-xpixmap": {
      source: "apache",
      extensions: ["xpm"]
    },
    "image/x-xwindowdump": {
      source: "apache",
      extensions: ["xwd"]
    },
    "message/cpim": {
      source: "iana"
    },
    "message/delivery-status": {
      source: "iana"
    },
    "message/disposition-notification": {
      source: "iana"
    },
    "message/external-body": {
      source: "iana"
    },
    "message/feedback-report": {
      source: "iana"
    },
    "message/global": {
      source: "iana"
    },
    "message/global-delivery-status": {
      source: "iana"
    },
    "message/global-disposition-notification": {
      source: "iana"
    },
    "message/global-headers": {
      source: "iana"
    },
    "message/http": {
      source: "iana",
      compressible: false
    },
    "message/imdn+xml": {
      source: "iana",
      compressible: true
    },
    "message/news": {
      source: "iana"
    },
    "message/partial": {
      source: "iana",
      compressible: false
    },
    "message/rfc822": {
      source: "iana",
      compressible: true,
      extensions: ["eml", "mime"]
    },
    "message/s-http": {
      source: "iana"
    },
    "message/sip": {
      source: "iana"
    },
    "message/sipfrag": {
      source: "iana"
    },
    "message/tracking-status": {
      source: "iana"
    },
    "message/vnd.si.simp": {
      source: "iana"
    },
    "message/vnd.wfa.wsc": {
      source: "iana"
    },
    "model/gltf+json": {
      source: "iana",
      compressible: true
    },
    "model/iges": {
      source: "iana",
      compressible: false,
      extensions: ["igs", "iges"]
    },
    "model/mesh": {
      source: "iana",
      compressible: false,
      extensions: ["msh", "mesh", "silo"]
    },
    "model/vnd.collada+xml": {
      source: "iana",
      extensions: ["dae"]
    },
    "model/vnd.dwf": {
      source: "iana",
      extensions: ["dwf"]
    },
    "model/vnd.flatland.3dml": {
      source: "iana"
    },
    "model/vnd.gdl": {
      source: "iana",
      extensions: ["gdl"]
    },
    "model/vnd.gs-gdl": {
      source: "apache"
    },
    "model/vnd.gs.gdl": {
      source: "iana"
    },
    "model/vnd.gtw": {
      source: "iana",
      extensions: ["gtw"]
    },
    "model/vnd.moml+xml": {
      source: "iana"
    },
    "model/vnd.mts": {
      source: "iana",
      extensions: ["mts"]
    },
    "model/vnd.opengex": {
      source: "iana"
    },
    "model/vnd.parasolid.transmit.binary": {
      source: "iana"
    },
    "model/vnd.parasolid.transmit.text": {
      source: "iana"
    },
    "model/vnd.rosette.annotated-data-model": {
      source: "iana"
    },
    "model/vnd.valve.source.compiled-map": {
      source: "iana"
    },
    "model/vnd.vtu": {
      source: "iana",
      extensions: ["vtu"]
    },
    "model/vrml": {
      source: "iana",
      compressible: false,
      extensions: ["wrl", "vrml"]
    },
    "model/x3d+binary": {
      source: "apache",
      compressible: false,
      extensions: ["x3db", "x3dbz"]
    },
    "model/x3d+fastinfoset": {
      source: "iana"
    },
    "model/x3d+vrml": {
      source: "apache",
      compressible: false,
      extensions: ["x3dv", "x3dvz"]
    },
    "model/x3d+xml": {
      source: "iana",
      compressible: true,
      extensions: ["x3d", "x3dz"]
    },
    "model/x3d-vrml": {
      source: "iana"
    },
    "multipart/alternative": {
      source: "iana",
      compressible: false
    },
    "multipart/appledouble": {
      source: "iana"
    },
    "multipart/byteranges": {
      source: "iana"
    },
    "multipart/digest": {
      source: "iana"
    },
    "multipart/encrypted": {
      source: "iana",
      compressible: false
    },
    "multipart/form-data": {
      source: "iana",
      compressible: false
    },
    "multipart/header-set": {
      source: "iana"
    },
    "multipart/mixed": {
      source: "iana",
      compressible: false
    },
    "multipart/parallel": {
      source: "iana"
    },
    "multipart/related": {
      source: "iana",
      compressible: false
    },
    "multipart/report": {
      source: "iana"
    },
    "multipart/signed": {
      source: "iana",
      compressible: false
    },
    "multipart/voice-message": {
      source: "iana"
    },
    "multipart/x-mixed-replace": {
      source: "iana"
    },
    "text/1d-interleaved-parityfec": {
      source: "iana"
    },
    "text/cache-manifest": {
      source: "iana",
      compressible: true,
      extensions: ["appcache", "manifest"]
    },
    "text/calendar": {
      source: "iana",
      extensions: ["ics", "ifb"]
    },
    "text/calender": {
      compressible: true
    },
    "text/cmd": {
      compressible: true
    },
    "text/coffeescript": {
      extensions: ["coffee", "litcoffee"]
    },
    "text/css": {
      source: "iana",
      compressible: true,
      extensions: ["css"]
    },
    "text/csv": {
      source: "iana",
      compressible: true,
      extensions: ["csv"]
    },
    "text/csv-schema": {
      source: "iana"
    },
    "text/directory": {
      source: "iana"
    },
    "text/dns": {
      source: "iana"
    },
    "text/ecmascript": {
      source: "iana"
    },
    "text/encaprtp": {
      source: "iana"
    },
    "text/enriched": {
      source: "iana"
    },
    "text/fwdred": {
      source: "iana"
    },
    "text/grammar-ref-list": {
      source: "iana"
    },
    "text/hjson": {
      extensions: ["hjson"]
    },
    "text/html": {
      source: "iana",
      compressible: true,
      extensions: ["html", "htm", "shtml"]
    },
    "text/jade": {
      extensions: ["jade"]
    },
    "text/javascript": {
      source: "iana",
      compressible: true
    },
    "text/jcr-cnd": {
      source: "iana"
    },
    "text/jsx": {
      compressible: true,
      extensions: ["jsx"]
    },
    "text/less": {
      extensions: ["less"]
    },
    "text/markdown": {
      source: "iana"
    },
    "text/mathml": {
      source: "nginx",
      extensions: ["mml"]
    },
    "text/mizar": {
      source: "iana"
    },
    "text/n3": {
      source: "iana",
      compressible: true,
      extensions: ["n3"]
    },
    "text/parameters": {
      source: "iana"
    },
    "text/parityfec": {
      source: "iana"
    },
    "text/plain": {
      source: "iana",
      compressible: true,
      extensions: ["txt", "text", "conf", "def", "list", "log", "in", "ini"]
    },
    "text/provenance-notation": {
      source: "iana"
    },
    "text/prs.fallenstein.rst": {
      source: "iana"
    },
    "text/prs.lines.tag": {
      source: "iana",
      extensions: ["dsc"]
    },
    "text/prs.prop.logic": {
      source: "iana"
    },
    "text/raptorfec": {
      source: "iana"
    },
    "text/red": {
      source: "iana"
    },
    "text/rfc822-headers": {
      source: "iana"
    },
    "text/richtext": {
      source: "iana",
      compressible: true,
      extensions: ["rtx"]
    },
    "text/rtf": {
      source: "iana",
      compressible: true,
      extensions: ["rtf"]
    },
    "text/rtp-enc-aescm128": {
      source: "iana"
    },
    "text/rtploopback": {
      source: "iana"
    },
    "text/rtx": {
      source: "iana"
    },
    "text/sgml": {
      source: "iana",
      extensions: ["sgml", "sgm"]
    },
    "text/slim": {
      extensions: ["slim", "slm"]
    },
    "text/stylus": {
      extensions: ["stylus", "styl"]
    },
    "text/t140": {
      source: "iana"
    },
    "text/tab-separated-values": {
      source: "iana",
      compressible: true,
      extensions: ["tsv"]
    },
    "text/troff": {
      source: "iana",
      extensions: ["t", "tr", "roff", "man", "me", "ms"]
    },
    "text/turtle": {
      source: "iana",
      extensions: ["ttl"]
    },
    "text/ulpfec": {
      source: "iana"
    },
    "text/uri-list": {
      source: "iana",
      compressible: true,
      extensions: ["uri", "uris", "urls"]
    },
    "text/vcard": {
      source: "iana",
      compressible: true,
      extensions: ["vcard"]
    },
    "text/vnd.a": {
      source: "iana"
    },
    "text/vnd.abc": {
      source: "iana"
    },
    "text/vnd.ascii-art": {
      source: "iana"
    },
    "text/vnd.curl": {
      source: "iana",
      extensions: ["curl"]
    },
    "text/vnd.curl.dcurl": {
      source: "apache",
      extensions: ["dcurl"]
    },
    "text/vnd.curl.mcurl": {
      source: "apache",
      extensions: ["mcurl"]
    },
    "text/vnd.curl.scurl": {
      source: "apache",
      extensions: ["scurl"]
    },
    "text/vnd.debian.copyright": {
      source: "iana"
    },
    "text/vnd.dmclientscript": {
      source: "iana"
    },
    "text/vnd.dvb.subtitle": {
      source: "iana",
      extensions: ["sub"]
    },
    "text/vnd.esmertec.theme-descriptor": {
      source: "iana"
    },
    "text/vnd.fly": {
      source: "iana",
      extensions: ["fly"]
    },
    "text/vnd.fmi.flexstor": {
      source: "iana",
      extensions: ["flx"]
    },
    "text/vnd.graphviz": {
      source: "iana",
      extensions: ["gv"]
    },
    "text/vnd.in3d.3dml": {
      source: "iana",
      extensions: ["3dml"]
    },
    "text/vnd.in3d.spot": {
      source: "iana",
      extensions: ["spot"]
    },
    "text/vnd.iptc.newsml": {
      source: "iana"
    },
    "text/vnd.iptc.nitf": {
      source: "iana"
    },
    "text/vnd.latex-z": {
      source: "iana"
    },
    "text/vnd.motorola.reflex": {
      source: "iana"
    },
    "text/vnd.ms-mediapackage": {
      source: "iana"
    },
    "text/vnd.net2phone.commcenter.command": {
      source: "iana"
    },
    "text/vnd.radisys.msml-basic-layout": {
      source: "iana"
    },
    "text/vnd.si.uricatalogue": {
      source: "iana"
    },
    "text/vnd.sun.j2me.app-descriptor": {
      source: "iana",
      extensions: ["jad"]
    },
    "text/vnd.trolltech.linguist": {
      source: "iana"
    },
    "text/vnd.wap.si": {
      source: "iana"
    },
    "text/vnd.wap.sl": {
      source: "iana"
    },
    "text/vnd.wap.wml": {
      source: "iana",
      extensions: ["wml"]
    },
    "text/vnd.wap.wmlscript": {
      source: "iana",
      extensions: ["wmls"]
    },
    "text/vtt": {
      charset: "UTF-8",
      compressible: true,
      extensions: ["vtt"]
    },
    "text/x-asm": {
      source: "apache",
      extensions: ["s", "asm"]
    },
    "text/x-c": {
      source: "apache",
      extensions: ["c", "cc", "cxx", "cpp", "h", "hh", "dic"]
    },
    "text/x-component": {
      source: "nginx",
      extensions: ["htc"]
    },
    "text/x-fortran": {
      source: "apache",
      extensions: ["f", "for", "f77", "f90"]
    },
    "text/x-gwt-rpc": {
      compressible: true
    },
    "text/x-handlebars-template": {
      extensions: ["hbs"]
    },
    "text/x-java-source": {
      source: "apache",
      extensions: ["java"]
    },
    "text/x-jquery-tmpl": {
      compressible: true
    },
    "text/x-lua": {
      extensions: ["lua"]
    },
    "text/x-markdown": {
      compressible: true,
      extensions: ["markdown", "md", "mkd"]
    },
    "text/x-nfo": {
      source: "apache",
      extensions: ["nfo"]
    },
    "text/x-opml": {
      source: "apache",
      extensions: ["opml"]
    },
    "text/x-pascal": {
      source: "apache",
      extensions: ["p", "pas"]
    },
    "text/x-processing": {
      compressible: true,
      extensions: ["pde"]
    },
    "text/x-sass": {
      extensions: ["sass"]
    },
    "text/x-scss": {
      extensions: ["scss"]
    },
    "text/x-setext": {
      source: "apache",
      extensions: ["etx"]
    },
    "text/x-sfv": {
      source: "apache",
      extensions: ["sfv"]
    },
    "text/x-suse-ymp": {
      compressible: true,
      extensions: ["ymp"]
    },
    "text/x-uuencode": {
      source: "apache",
      extensions: ["uu"]
    },
    "text/x-vcalendar": {
      source: "apache",
      extensions: ["vcs"]
    },
    "text/x-vcard": {
      source: "apache",
      extensions: ["vcf"]
    },
    "text/xml": {
      source: "iana",
      compressible: true,
      extensions: ["xml"]
    },
    "text/xml-external-parsed-entity": {
      source: "iana"
    },
    "text/yaml": {
      extensions: ["yaml", "yml"]
    },
    "video/1d-interleaved-parityfec": {
      source: "apache"
    },
    "video/3gpp": {
      source: "apache",
      extensions: ["3gp", "3gpp"]
    },
    "video/3gpp-tt": {
      source: "apache"
    },
    "video/3gpp2": {
      source: "apache",
      extensions: ["3g2"]
    },
    "video/bmpeg": {
      source: "apache"
    },
    "video/bt656": {
      source: "apache"
    },
    "video/celb": {
      source: "apache"
    },
    "video/dv": {
      source: "apache"
    },
    "video/encaprtp": {
      source: "apache"
    },
    "video/h261": {
      source: "apache",
      extensions: ["h261"]
    },
    "video/h263": {
      source: "apache",
      extensions: ["h263"]
    },
    "video/h263-1998": {
      source: "apache"
    },
    "video/h263-2000": {
      source: "apache"
    },
    "video/h264": {
      source: "apache",
      extensions: ["h264"]
    },
    "video/h264-rcdo": {
      source: "apache"
    },
    "video/h264-svc": {
      source: "apache"
    },
    "video/h265": {
      source: "apache"
    },
    "video/iso.segment": {
      source: "apache"
    },
    "video/jpeg": {
      source: "apache",
      extensions: ["jpgv"]
    },
    "video/jpeg2000": {
      source: "apache"
    },
    "video/jpm": {
      source: "apache",
      extensions: ["jpm", "jpgm"]
    },
    "video/mj2": {
      source: "apache",
      extensions: ["mj2", "mjp2"]
    },
    "video/mp1s": {
      source: "apache"
    },
    "video/mp2p": {
      source: "apache"
    },
    "video/mp2t": {
      source: "apache",
      extensions: ["ts"]
    },
    "video/mp4": {
      source: "apache",
      compressible: false,
      extensions: ["mp4", "mp4v", "mpg4"]
    },
    "video/mp4v-es": {
      source: "apache"
    },
    "video/mpeg": {
      source: "apache",
      compressible: false,
      extensions: ["mpeg", "mpg", "mpe", "m1v", "m2v"]
    },
    "video/mpeg4-generic": {
      source: "apache"
    },
    "video/mpv": {
      source: "apache"
    },
    "video/nv": {
      source: "apache"
    },
    "video/ogg": {
      source: "apache",
      compressible: false,
      extensions: ["ogv"]
    },
    "video/parityfec": {
      source: "apache"
    },
    "video/pointer": {
      source: "apache"
    },
    "video/quicktime": {
      source: "apache",
      compressible: false,
      extensions: ["qt", "mov"]
    },
    "video/raptorfec": {
      source: "apache"
    },
    "video/raw": {
      source: "apache"
    },
    "video/rtp-enc-aescm128": {
      source: "apache"
    },
    "video/rtploopback": {
      source: "apache"
    },
    "video/rtx": {
      source: "apache"
    },
    "video/smpte292m": {
      source: "apache"
    },
    "video/ulpfec": {
      source: "apache"
    },
    "video/vc1": {
      source: "apache"
    },
    "video/vnd.cctv": {
      source: "apache"
    },
    "video/vnd.dece.hd": {
      source: "apache",
      extensions: ["uvh", "uvvh"]
    },
    "video/vnd.dece.mobile": {
      source: "apache",
      extensions: ["uvm", "uvvm"]
    },
    "video/vnd.dece.mp4": {
      source: "apache"
    },
    "video/vnd.dece.pd": {
      source: "apache",
      extensions: ["uvp", "uvvp"]
    },
    "video/vnd.dece.sd": {
      source: "apache",
      extensions: ["uvs", "uvvs"]
    },
    "video/vnd.dece.video": {
      source: "apache",
      extensions: ["uvv", "uvvv"]
    },
    "video/vnd.directv.mpeg": {
      source: "apache"
    },
    "video/vnd.directv.mpeg-tts": {
      source: "apache"
    },
    "video/vnd.dlna.mpeg-tts": {
      source: "apache"
    },
    "video/vnd.dvb.file": {
      source: "apache",
      extensions: ["dvb"]
    },
    "video/vnd.fvt": {
      source: "apache",
      extensions: ["fvt"]
    },
    "video/vnd.hns.video": {
      source: "apache"
    },
    "video/vnd.iptvforum.1dparityfec-1010": {
      source: "apache"
    },
    "video/vnd.iptvforum.1dparityfec-2005": {
      source: "apache"
    },
    "video/vnd.iptvforum.2dparityfec-1010": {
      source: "apache"
    },
    "video/vnd.iptvforum.2dparityfec-2005": {
      source: "apache"
    },
    "video/vnd.iptvforum.ttsavc": {
      source: "apache"
    },
    "video/vnd.iptvforum.ttsmpeg2": {
      source: "apache"
    },
    "video/vnd.motorola.video": {
      source: "apache"
    },
    "video/vnd.motorola.videop": {
      source: "apache"
    },
    "video/vnd.mpegurl": {
      source: "apache",
      extensions: ["mxu", "m4u"]
    },
    "video/vnd.ms-playready.media.pyv": {
      source: "apache",
      extensions: ["pyv"]
    },
    "video/vnd.nokia.interleaved-multimedia": {
      source: "apache"
    },
    "video/vnd.nokia.videovoip": {
      source: "apache"
    },
    "video/vnd.objectvideo": {
      source: "apache"
    },
    "video/vnd.radgamettools.bink": {
      source: "apache"
    },
    "video/vnd.radgamettools.smacker": {
      source: "apache"
    },
    "video/vnd.sealed.mpeg1": {
      source: "apache"
    },
    "video/vnd.sealed.mpeg4": {
      source: "apache"
    },
    "video/vnd.sealed.swf": {
      source: "apache"
    },
    "video/vnd.sealedmedia.softseal.mov": {
      source: "apache"
    },
    "video/vnd.uvvu.mp4": {
      source: "apache",
      extensions: ["uvu", "uvvu"]
    },
    "video/vnd.vivo": {
      source: "apache",
      extensions: ["viv"]
    },
    "video/vp8": {
      source: "apache"
    },
    "video/webm": {
      source: "apache",
      compressible: false,
      extensions: ["webm"]
    },
    "video/x-f4v": {
      source: "apache",
      extensions: ["f4v"]
    },
    "video/x-fli": {
      source: "apache",
      extensions: ["fli"]
    },
    "video/x-flv": {
      source: "apache",
      compressible: false,
      extensions: ["flv"]
    },
    "video/x-m4v": {
      source: "apache",
      extensions: ["m4v"]
    },
    "video/x-matroska": {
      source: "apache",
      compressible: false,
      extensions: ["mkv", "mk3d", "mks"]
    },
    "video/x-mng": {
      source: "apache",
      extensions: ["mng"]
    },
    "video/x-ms-asf": {
      source: "apache",
      extensions: ["asf", "asx"]
    },
    "video/x-ms-vob": {
      source: "apache",
      extensions: ["vob"]
    },
    "video/x-ms-wm": {
      source: "apache",
      extensions: ["wm"]
    },
    "video/x-ms-wmv": {
      source: "apache",
      compressible: false,
      extensions: ["wmv"]
    },
    "video/x-ms-wmx": {
      source: "apache",
      extensions: ["wmx"]
    },
    "video/x-ms-wvx": {
      source: "apache",
      extensions: ["wvx"]
    },
    "video/x-msvideo": {
      source: "apache",
      extensions: ["avi"]
    },
    "video/x-sgi-movie": {
      source: "apache",
      extensions: ["movie"]
    },
    "video/x-smv": {
      source: "apache",
      extensions: ["smv"]
    },
    "x-conference/x-cooltalk": {
      source: "apache",
      extensions: ["ice"]
    },
    "x-shader/x-fragment": {
      compressible: true
    },
    "x-shader/x-vertex": {
      compressible: true
    }
  };
});

// node_modules/mime-db/index.js
var require_mime_db = __commonJS((exports, module) => {
  /*!
   * mime-db
   * Copyright(c) 2014 Jonathan Ong
   * MIT Licensed
   */
  module.exports = require_db();
});

// node_modules/mime-types/index.js
var require_mime_types = __commonJS((exports) => {
  /*!
   * mime-types
   * Copyright(c) 2014 Jonathan Ong
   * Copyright(c) 2015 Douglas Christopher Wilson
   * MIT Licensed
   */
  var db = require_mime_db();
  var extname = __require("path").extname;
  var extractTypeRegExp = /^\s*([^;\s]*)(?:;|\s|$)/;
  var textTypeRegExp = /^text\//i;
  exports.charset = charset;
  exports.charsets = { lookup: charset };
  exports.contentType = contentType;
  exports.extension = extension;
  exports.extensions = Object.create(null);
  exports.lookup = lookup;
  exports.types = Object.create(null);
  populateMaps(exports.extensions, exports.types);
  function charset(type) {
    if (!type || typeof type !== "string") {
      return false;
    }
    var match = extractTypeRegExp.exec(type);
    var mime = match && db[match[1].toLowerCase()];
    if (mime && mime.charset) {
      return mime.charset;
    }
    if (match && textTypeRegExp.test(match[1])) {
      return "UTF-8";
    }
    return false;
  }
  function contentType(str) {
    if (!str || typeof str !== "string") {
      return false;
    }
    var mime = str.indexOf("/") === -1 ? exports.lookup(str) : str;
    if (!mime) {
      return false;
    }
    if (mime.indexOf("charset") === -1) {
      var charset2 = exports.charset(mime);
      if (charset2)
        mime += "; charset=" + charset2.toLowerCase();
    }
    return mime;
  }
  function extension(type) {
    if (!type || typeof type !== "string") {
      return false;
    }
    var match = extractTypeRegExp.exec(type);
    var exts = match && exports.extensions[match[1].toLowerCase()];
    if (!exts || !exts.length) {
      return false;
    }
    return exts[0];
  }
  function lookup(path) {
    if (!path || typeof path !== "string") {
      return false;
    }
    var extension2 = extname("x." + path).toLowerCase().substr(1);
    if (!extension2) {
      return false;
    }
    return exports.types[extension2] || false;
  }
  function populateMaps(extensions, types) {
    var preference = ["nginx", "apache", undefined, "iana"];
    Object.keys(db).forEach(function forEachMimeType(type) {
      var mime = db[type];
      var exts = mime.extensions;
      if (!exts || !exts.length) {
        return;
      }
      extensions[type] = exts;
      for (var i = 0;i < exts.length; i++) {
        var extension2 = exts[i];
        if (types[extension2]) {
          var from = preference.indexOf(db[types[extension2]].source);
          var to = preference.indexOf(mime.source);
          if (types[extension2] !== "application/octet-stream" && from > to || from === to && types[extension2].substr(0, 12) === "application/") {
            continue;
          }
        }
        types[extension2] = type;
      }
    });
  }
});

// node_modules/xml/lib/escapeForXML.js
var require_escapeForXML = __commonJS((exports, module) => {
  var XML_CHARACTER_MAP = {
    "&": "&amp;",
    '"': "&quot;",
    "'": "&apos;",
    "<": "&lt;",
    ">": "&gt;"
  };
  function escapeForXML(string) {
    return string && string.replace ? string.replace(/([&"<>'])/g, function(str, item2) {
      return XML_CHARACTER_MAP[item2];
    }) : string;
  }
  module.exports = escapeForXML;
});

// node_modules/xml/lib/xml.js
var require_xml = __commonJS((exports, module) => {
  var escapeForXML = require_escapeForXML();
  var Stream = __require("stream").Stream;
  var DEFAULT_INDENT = "    ";
  function xml(input, options) {
    if (typeof options !== "object") {
      options = {
        indent: options
      };
    }
    var stream = options.stream ? new Stream : null, output = "", interrupted = false, indent = !options.indent ? "" : options.indent === true ? DEFAULT_INDENT : options.indent, instant = true;
    function delay(func) {
      if (!instant) {
        func();
      } else {
        process.nextTick(func);
      }
    }
    function append(interrupt, out) {
      if (out !== undefined) {
        output += out;
      }
      if (interrupt && !interrupted) {
        stream = stream || new Stream;
        interrupted = true;
      }
      if (interrupt && interrupted) {
        var data = output;
        delay(function() {
          stream.emit("data", data);
        });
        output = "";
      }
    }
    function add(value, last) {
      format(append, resolve(value, indent, indent ? 1 : 0), last);
    }
    function end() {
      if (stream) {
        var data = output;
        delay(function() {
          stream.emit("data", data);
          stream.emit("end");
          stream.readable = false;
          stream.emit("close");
        });
      }
    }
    function addXmlDeclaration(declaration) {
      var encoding = declaration.encoding || "UTF-8", attr = { version: "1.0", encoding };
      if (declaration.standalone) {
        attr.standalone = declaration.standalone;
      }
      add({ "?xml": { _attr: attr } });
      output = output.replace("/>", "?>");
    }
    delay(function() {
      instant = false;
    });
    if (options.declaration) {
      addXmlDeclaration(options.declaration);
    }
    if (input && input.forEach) {
      input.forEach(function(value, i) {
        var last;
        if (i + 1 === input.length)
          last = end;
        add(value, last);
      });
    } else {
      add(input, end);
    }
    if (stream) {
      stream.readable = true;
      return stream;
    }
    return output;
  }
  function element() {
    var input = Array.prototype.slice.call(arguments), self = {
      _elem: resolve(input)
    };
    self.push = function(input2) {
      if (!this.append) {
        throw new Error("not assigned to a parent!");
      }
      var that = this;
      var indent = this._elem.indent;
      format(this.append, resolve(input2, indent, this._elem.icount + (indent ? 1 : 0)), function() {
        that.append(true);
      });
    };
    self.close = function(input2) {
      if (input2 !== undefined) {
        this.push(input2);
      }
      if (this.end) {
        this.end();
      }
    };
    return self;
  }
  function create_indent(character, count) {
    return new Array(count || 0).join(character || "");
  }
  function resolve(data, indent, indent_count) {
    indent_count = indent_count || 0;
    var indent_spaces = create_indent(indent, indent_count);
    var name;
    var values = data;
    var interrupt = false;
    if (typeof data === "object") {
      var keys = Object.keys(data);
      name = keys[0];
      values = data[name];
      if (values && values._elem) {
        values._elem.name = name;
        values._elem.icount = indent_count;
        values._elem.indent = indent;
        values._elem.indents = indent_spaces;
        values._elem.interrupt = values;
        return values._elem;
      }
    }
    var attributes = [], content = [];
    var isStringContent;
    function get_attributes(obj) {
      var keys2 = Object.keys(obj);
      keys2.forEach(function(key) {
        attributes.push(attribute(key, obj[key]));
      });
    }
    switch (typeof values) {
      case "object":
        if (values === null)
          break;
        if (values._attr) {
          get_attributes(values._attr);
        }
        if (values._cdata) {
          content.push(("<![CDATA[" + values._cdata).replace(/\]\]>/g, "]]]]><![CDATA[>") + "]]>");
        }
        if (values.forEach) {
          isStringContent = false;
          content.push("");
          values.forEach(function(value) {
            if (typeof value == "object") {
              var _name = Object.keys(value)[0];
              if (_name == "_attr") {
                get_attributes(value._attr);
              } else {
                content.push(resolve(value, indent, indent_count + 1));
              }
            } else {
              content.pop();
              isStringContent = true;
              content.push(escapeForXML(value));
            }
          });
          if (!isStringContent) {
            content.push("");
          }
        }
        break;
      default:
        content.push(escapeForXML(values));
    }
    return {
      name,
      interrupt,
      attributes,
      content,
      icount: indent_count,
      indents: indent_spaces,
      indent
    };
  }
  function format(append, elem, end) {
    if (typeof elem != "object") {
      return append(false, elem);
    }
    var len = elem.interrupt ? 1 : elem.content.length;
    function proceed() {
      while (elem.content.length) {
        var value = elem.content.shift();
        if (value === undefined)
          continue;
        if (interrupt(value))
          return;
        format(append, value);
      }
      append(false, (len > 1 ? elem.indents : "") + (elem.name ? "</" + elem.name + ">" : "") + (elem.indent && !end ? `
` : ""));
      if (end) {
        end();
      }
    }
    function interrupt(value) {
      if (value.interrupt) {
        value.interrupt.append = append;
        value.interrupt.end = proceed;
        value.interrupt = false;
        append(true);
        return true;
      }
      return false;
    }
    append(false, elem.indents + (elem.name ? "<" + elem.name : "") + (elem.attributes.length ? " " + elem.attributes.join(" ") : "") + (len ? elem.name ? ">" : "" : elem.name ? "/>" : "") + (elem.indent && len > 1 ? `
` : ""));
    if (!len) {
      return append(false, elem.indent ? `
` : "");
    }
    if (!interrupt(elem)) {
      proceed();
    }
  }
  function attribute(key, value) {
    return key + "=" + '"' + escapeForXML(value) + '"';
  }
  module.exports = xml;
  module.exports.element = module.exports.Element = element;
});

// node_modules/rss/lib/index.js
var require_lib = __commonJS((exports, module) => {
  var mime = require_mime_types();
  var xml = require_xml();
  var fs = __require("fs");
  function ifTruePush(bool, array, data) {
    if (bool) {
      array.push(data);
    }
  }
  function ifTruePushArray(bool, array, dataArray) {
    if (!bool) {
      return;
    }
    dataArray.forEach(function(item2) {
      ifTruePush(item2, array, item2);
    });
  }
  function getSize(filename) {
    if (typeof fs === "undefined") {
      return 0;
    }
    return fs.statSync(filename).size;
  }
  function generateXML(data) {
    var channel = [];
    channel.push({ title: { _cdata: data.title } });
    channel.push({ description: { _cdata: data.description || data.title } });
    channel.push({ link: data.site_url || "http://github.com/dylang/node-rss" });
    if (data.image_url) {
      channel.push({ image: [{ url: data.image_url }, { title: data.title }, { link: data.site_url }] });
    }
    channel.push({ generator: data.generator });
    channel.push({ lastBuildDate: new Date().toUTCString() });
    ifTruePush(data.feed_url, channel, { "atom:link": { _attr: { href: data.feed_url, rel: "self", type: "application/rss+xml" } } });
    ifTruePush(data.author, channel, { author: { _cdata: data.author } });
    ifTruePush(data.pubDate, channel, { pubDate: new Date(data.pubDate).toGMTString() });
    ifTruePush(data.copyright, channel, { copyright: { _cdata: data.copyright } });
    ifTruePush(data.language, channel, { language: { _cdata: data.language } });
    ifTruePush(data.managingEditor, channel, { managingEditor: { _cdata: data.managingEditor } });
    ifTruePush(data.webMaster, channel, { webMaster: { _cdata: data.webMaster } });
    ifTruePush(data.docs, channel, { docs: data.docs });
    ifTruePush(data.ttl, channel, { ttl: data.ttl });
    ifTruePush(data.hub, channel, { "atom:link": { _attr: { href: data.hub, rel: "hub" } } });
    if (data.categories) {
      data.categories.forEach(function(category) {
        ifTruePush(category, channel, { category: { _cdata: category } });
      });
    }
    ifTruePushArray(data.custom_elements, channel, data.custom_elements);
    data.items.forEach(function(item2) {
      var item_values = [
        { title: { _cdata: item2.title } }
      ];
      ifTruePush(item2.description, item_values, { description: { _cdata: item2.description } });
      ifTruePush(item2.url, item_values, { link: item2.url });
      ifTruePush(item2.link || item2.guid || item2.title, item_values, { guid: [{ _attr: { isPermaLink: !item2.guid && !!item2.url } }, item2.guid || item2.url || item2.title] });
      item2.categories.forEach(function(category) {
        ifTruePush(category, item_values, { category: { _cdata: category } });
      });
      ifTruePush(item2.author || data.author, item_values, { "dc:creator": { _cdata: item2.author || data.author } });
      ifTruePush(item2.date, item_values, { pubDate: new Date(item2.date).toGMTString() });
      data.geoRSS = data.geoRSS || item2.lat && item2.long;
      ifTruePush(item2.lat, item_values, { "geo:lat": item2.lat });
      ifTruePush(item2.long, item_values, { "geo:long": item2.long });
      if (item2.enclosure && item2.enclosure.url) {
        if (item2.enclosure.file) {
          item_values.push({
            enclosure: {
              _attr: {
                url: item2.enclosure.url,
                length: item2.enclosure.size || getSize(item2.enclosure.file),
                type: item2.enclosure.type || mime.lookup(item2.enclosure.file)
              }
            }
          });
        } else {
          item_values.push({
            enclosure: {
              _attr: {
                url: item2.enclosure.url,
                length: item2.enclosure.size || 0,
                type: item2.enclosure.type || mime.lookup(item2.enclosure.url)
              }
            }
          });
        }
      }
      ifTruePushArray(item2.custom_elements, item_values, item2.custom_elements);
      channel.push({ item: item_values });
    });
    var _attr = {
      "xmlns:dc": "http://purl.org/dc/elements/1.1/",
      "xmlns:content": "http://purl.org/rss/1.0/modules/content/",
      "xmlns:atom": "http://www.w3.org/2005/Atom",
      version: "2.0"
    };
    Object.keys(data.custom_namespaces).forEach(function(name) {
      _attr["xmlns:" + name] = data.custom_namespaces[name];
    });
    if (data.geoRSS) {
      _attr["xmlns:geo"] = "http://www.w3.org/2003/01/geo/wgs84_pos#";
    }
    return {
      rss: [
        { _attr },
        { channel }
      ]
    };
  }
  function RSS(options, items) {
    options = options || {};
    this.title = options.title || "Untitled RSS Feed";
    this.description = options.description || "";
    this.generator = options.generator || "RSS for Node";
    this.feed_url = options.feed_url;
    this.site_url = options.site_url;
    this.image_url = options.image_url;
    this.author = options.author;
    this.categories = options.categories;
    this.pubDate = options.pubDate;
    this.hub = options.hub;
    this.docs = options.docs;
    this.copyright = options.copyright;
    this.language = options.language;
    this.managingEditor = options.managingEditor;
    this.webMaster = options.webMaster;
    this.ttl = options.ttl;
    this.geoRSS = options.geoRSS || false;
    this.custom_namespaces = options.custom_namespaces || {};
    this.custom_elements = options.custom_elements || [];
    this.items = items || [];
    this.item = function(options2) {
      options2 = options2 || {};
      var item2 = {
        title: options2.title || "No title",
        description: options2.description || "",
        url: options2.url,
        guid: options2.guid,
        categories: options2.categories || [],
        author: options2.author,
        date: options2.date,
        lat: options2.lat,
        long: options2.long,
        enclosure: options2.enclosure || false,
        custom_elements: options2.custom_elements || []
      };
      this.items.push(item2);
      return this;
    };
    this.xml = function(indent) {
      return '<?xml version="1.0" encoding="UTF-8"?>' + xml(generateXML(this), indent);
    };
  }
  module.exports = RSS;
});

// src/index.ts
var import_grammy = __toESM(require_mod(), 1);

// src/download.ts
var import_youtube_dl_exec2 = __toESM(require_src3(), 1);

// src/db.ts
import { Database } from "bun:sqlite";
var dbName = () => Bun.env.IS_TEST ? "youtube2rss.test.db" : "youtube2rss.db";
var addVideoToDb = async (videoId, videoName, videoDescription, videoUrl, videoAddeddate, videoPath, videoLength) => {
  const db = new Database(dbName(), { readwrite: true });
  db.run("INSERT INTO videos (video_id, video_name, video_description, video_url, video_added_date, video_path, video_length) VALUES (?,?,?,?,?,?,?)", [videoId, videoName, videoDescription, videoUrl, videoAddeddate, videoPath, videoLength]);
  db.close();
};
var getAllVideos = () => {
  const db = new Database(dbName(), { readwrite: true });
  const query = db.query("SELECT * FROM videos");
  const videos = query.all(null);
  db.close();
  return videos;
};
var isVideoExists = (videoId) => {
  const db = new Database(dbName(), { readwrite: true });
  const query = db.query("SELECT EXISTS (SELECT * FROM videos WHERE video_id = ?)");
  const video = query.all(videoId);
  db.close();
  return Boolean(Object.values(video[0])[0]);
};
// node_modules/podcast/dist/esm/index.js
var import_rss = __toESM(require_lib(), 1);

// node_modules/podcast/dist/esm/deprecate.js
var warnedPositions = {};
function deprecate2(data) {
  const stack = new Error().stack || "";
  let at = (stack.match(/(?:\s+at\s.+){2}\s+at\s(.+)/) || [undefined, ""])[1];
  if (!at) {
    throw new Error("Regex error");
  }
  if (/\)$/.test(at)) {
    const res = at.match(/[^(]+(?=\)$)/);
    if (res) {
      [at] = res;
    }
  } else {
    at = at.trim();
  }
  if (at in warnedPositions) {
    return;
  }
  warnedPositions[at] = true;
  let message;
  switch (data.type) {
    case "class":
      message = "Class";
      break;
    case "property":
      message = "Property";
      break;
    case "option":
      message = "Option";
      break;
    case "method":
      message = "Method";
      break;
    case "function":
      message = "Function";
      break;
    default:
      message = data.type || "";
  }
  message += ` \`${data.name}\` has been deprecated`;
  if (data.version) {
    message += ` since version ${data.version}`;
  }
  if (data.alternative) {
    message += `, use \`${data.alternative}\` instead`;
  }
  message += ".";
  if (at) {
    message += `
    at ${at}`;
  }
  console.warn(message);
}
var deprecate_default = deprecate2;

// node_modules/podcast/dist/esm/build-itunes-category-elements.js
var buildITunesCategoryElements = (categories) => {
  const arr = [];
  if (Array.isArray(categories)) {
    for (const category of categories) {
      if (category.subcats) {
        const elements = [
          { _attr: { text: category.text } }
        ];
        const cats = buildITunesCategoryElements(category.subcats);
        elements.push(...cats);
        arr.push({ "itunes:category": elements });
      } else {
        arr.push({ "itunes:category": { _attr: { text: category.text } } });
      }
    }
  }
  return arr;
};

// node_modules/podcast/dist/esm/build-simple-chapters-element.js
var buildSimpleChaptersElement = (chapters) => {
  const chaptersElement = {
    "psc:chapters": [
      {
        _attr: {
          version: chapters.version,
          "xmlns:psc": "http://podlove.org/simple-chapters"
        }
      }
    ]
  };
  if (Array.isArray(chapters.chapter)) {
    for (const chapter of chapters.chapter) {
      const chapterElement = {
        "psc:chapter": {
          _attr: chapter
        }
      };
      chaptersElement["psc:chapters"].push(chapterElement);
    }
  }
  return chaptersElement;
};

// node_modules/podcast/dist/esm/duration-format.js
function pad(num) {
  const paddedString = `0${num}`;
  return paddedString.substring(paddedString.length - 2);
}
function toDurationString(seconds) {
  if (typeof seconds !== "number") {
    return seconds;
  }
  const hh = Math.floor(seconds / (60 * 60));
  const remain = seconds % (60 * 60);
  const mm = Math.floor(remain / 60);
  const ss = Math.floor(remain % 60);
  return `${pad(hh)}:${pad(mm)}:${pad(ss)}`;
}
var duration_format_default = toDurationString;

// node_modules/podcast/dist/esm/index.js
class Podcast {
  constructor(options = {}, items = []) {
    this.items = [];
    this.options = {};
    this.options = this.getOptionDefaults(options);
    this.feed = this.init(this.options, items);
  }
  getOptionDefaults(_options) {
    const options = Object.assign(Object.assign({}, _options), { title: _options.title || "Untitled Podcast Feed", description: _options.description || "", feedUrl: _options.feedUrl || "", siteUrl: _options.siteUrl || "", generator: _options.generator || "Podcast for Node", customElements: _options.customElements || [], customNamespaces: Object.assign({}, _options.customNamespaces) });
    options.itunesOwner = options.itunesOwner || {
      name: options.author || "",
      email: ""
    };
    options.namespaces = options.namespaces || {};
    if (typeof options.namespaces.iTunes === "undefined") {
      options.namespaces.iTunes = true;
    }
    if (typeof options.namespaces.podcast === "undefined") {
      options.namespaces.podcast = true;
    }
    if (typeof options.namespaces.simpleChapters === "undefined") {
      options.namespaces.simpleChapters = true;
    }
    return options;
  }
  getNamespaces(options) {
    var _a, _b, _c;
    const namespaces = Object.assign({}, options.customNamespaces);
    if ((_a = options.namespaces) === null || _a === undefined ? undefined : _a.iTunes) {
      namespaces.itunes = "http://www.itunes.com/dtds/podcast-1.0.dtd";
    }
    if ((_b = options.namespaces) === null || _b === undefined ? undefined : _b.simpleChapters) {
      namespaces.psc = "http://podlove.org/simple-chapters";
    }
    if ((_c = options.namespaces) === null || _c === undefined ? undefined : _c.podcast) {
      namespaces.podcast = "https://podcastindex.org/namespace/1.0";
    }
    return namespaces;
  }
  getITunesFeedElements(options) {
    var _a, _b;
    const customElements = [];
    if (options.itunesAuthor || options.author) {
      customElements.push({
        "itunes:author": options.itunesAuthor || options.author
      });
    }
    if (options.itunesSubtitle) {
      customElements.push({
        "itunes:subtitle": options.itunesSubtitle
      });
    }
    if (options.itunesSummary || options.description) {
      customElements.push({
        "itunes:summary": options.itunesSummary || options.description
      });
    }
    if (options.itunesType) {
      customElements.push({
        "itunes:type": options.itunesType
      });
    }
    customElements.push({
      "itunes:owner": [
        { "itunes:name": ((_a = options.itunesOwner) === null || _a === undefined ? undefined : _a.name) || "" },
        { "itunes:email": ((_b = options.itunesOwner) === null || _b === undefined ? undefined : _b.email) || "" }
      ]
    });
    customElements.push({
      "itunes:explicit": typeof options.itunesExplicit === "boolean" ? !!options.itunesExplicit : options.itunesExplicit || false
    });
    if (options.itunesCategory) {
      const categories = buildITunesCategoryElements(options.itunesCategory);
      categories.forEach((category) => {
        customElements.push(category);
      });
    }
    if (options.itunesImage || options.imageUrl) {
      customElements.push({
        "itunes:image": {
          _attr: {
            href: options.itunesImage || options.imageUrl
          }
        }
      });
    }
    return customElements;
  }
  init(options, items = []) {
    var _a;
    const feed2 = Object.assign({}, this.options);
    feed2.customNamespaces = Object.assign({}, this.getNamespaces(options));
    if ((_a = options.namespaces) === null || _a === undefined ? undefined : _a.iTunes) {
      feed2.customElements = [
        ...feed2.customElements || [],
        ...this.getITunesFeedElements(options)
      ];
    }
    this.items = [];
    const initialItems = items;
    initialItems.forEach((item2) => this.addItem(item2));
    return feed2;
  }
  getITunesItemElements(itemOptions) {
    const customElements = [];
    if (itemOptions.itunesAuthor || itemOptions.author) {
      customElements.push({
        "itunes:author": itemOptions.itunesAuthor || itemOptions.author
      });
    }
    if (itemOptions.itunesSubtitle) {
      customElements.push({
        "itunes:subtitle": itemOptions.itunesSubtitle
      });
    }
    if (itemOptions.itunesSummary || itemOptions.description) {
      customElements.push({
        "itunes:summary": itemOptions.itunesSummary || itemOptions.description
      });
    }
    customElements.push({
      "itunes:explicit": typeof itemOptions.itunesExplicit === "boolean" ? !!itemOptions.itunesExplicit : itemOptions.itunesExplicit || false
    });
    if (itemOptions.itunesDuration) {
      customElements.push({
        "itunes:duration": duration_format_default(itemOptions.itunesDuration)
      });
    }
    if (itemOptions.itunesKeywords) {
      deprecate_default({ name: "itunesKeywords", type: "option" });
      customElements.push({
        "itunes:keywords": itemOptions.itunesKeywords
      });
    }
    if (itemOptions.itunesImage || itemOptions.imageUrl) {
      customElements.push({
        "itunes:image": {
          _attr: {
            href: itemOptions.itunesImage || itemOptions.imageUrl
          }
        }
      });
    }
    if (itemOptions.itunesSeason)
      customElements.push({ "itunes:season": itemOptions.itunesSeason });
    if (itemOptions.itunesEpisode)
      customElements.push({ "itunes:episode": itemOptions.itunesEpisode });
    if (itemOptions.itunesTitle)
      customElements.push({ "itunes:title": itemOptions.itunesTitle });
    if (itemOptions.itunesEpisodeType) {
      customElements.push({
        "itunes:episodeType": itemOptions.itunesEpisodeType
      });
    }
    if (itemOptions.itunesNewFeedUrl) {
      customElements.push({
        "itunes:new-feed-url": itemOptions.itunesNewFeedUrl
      });
    }
    return customElements;
  }
  addItem(itemOptions) {
    var _a, _b;
    const item2 = Object.assign({}, itemOptions);
    item2.customElements = item2.customElements || [];
    if (itemOptions.content) {
      item2.customElements.push({
        "content:encoded": {
          _cdata: itemOptions.content
        }
      });
    }
    if ((_a = this.options.namespaces) === null || _a === undefined ? undefined : _a.iTunes) {
      item2.customElements = [
        ...item2.customElements || [],
        ...this.getITunesItemElements(itemOptions)
      ];
    }
    if (((_b = this.options.namespaces) === null || _b === undefined ? undefined : _b.simpleChapters) && itemOptions.pscChapters) {
      item2.customElements = [
        ...item2.customElements || [],
        buildSimpleChaptersElement(itemOptions.pscChapters)
      ];
    }
    this.items.push(item2);
    return;
  }
  buildXml(options = {}) {
    const rss = new import_rss.default(Object.assign(Object.assign({}, this.feed), { feed_url: this.feed.feedUrl, site_url: this.feed.siteUrl, custom_elements: this.feed.customElements, custom_namespaces: this.feed.customNamespaces }));
    this.items.forEach((item2) => rss.item(Object.assign(Object.assign({}, item2), { custom_elements: item2.customElements })));
    return rss.xml(options);
  }
}

// src/helpers.ts
var import_youtube_dl_exec = __toESM(require_src3(), 1);
var getYoutubeVideoId = (message) => {
  const regex = /^https?:\/\/(?:(?:youtu\.be\/)|(?:(?:www\.)?youtube\.com\/(?:(?:watch\?(?:[^&]+&)?vi?=)|(?:vi?\/)|(?:shorts\/))))([a-zA-Z0-9_-]{11,})/gim;
  const res = regex.exec(message);
  return res && res[1];
};
var isS3Configured = () => {
  return Boolean(Bun.env.S3_ENDPOINT && Bun.env.S3_BUCKET && Bun.env.S3_ACCESS_KEY && Bun.env.S3_SECRET_KEY);
};
var getVideoInfo = async (videoId) => {
  const info = await import_youtube_dl_exec.default(`https://youtu.be/watch?v=${videoId}`, {
    dumpSingleJson: true,
    noCheckCertificates: true,
    noWarnings: true,
    preferFreeFormats: true,
    addHeader: ["referer:youtube.com", "user-agent:googlebot"]
  });
  if (typeof info === "string") {
    throw new Error("Failed to fetch video info");
  }
  return info;
};

// src/s3.ts
var {S3Client } = globalThis.Bun;
var s3client = new S3Client({
  endpoint: Bun.env.S3_ENDPOINT || "undefined.com",
  bucket: Bun.env.S3_BUCKET,
  accessKeyId: Bun.env.S3_ACCESS_KEY,
  secretAccessKey: Bun.env.S3_SECRET_KEY
});
var uploadFileOnS3 = async (videoId, filePath) => {
  try {
    await s3client.write(`files/${videoId}.mp3`, Bun.file(filePath));
  } catch (error) {
    console.error(`Error putting file on S3: ${error}`);
  }
};
var uploadXmlToS3 = async (filePath) => {
  try {
    await s3client.write(`rss.xml`, Bun.file(filePath));
  } catch (error) {
    console.error(`Error uploading XML to S3: ${error}`);
  }
};
var isCoverImageExistsOnS3 = async () => {
  try {
    const isCoverExists = await s3client.exists(`cover.jpg`);
    if (!isCoverExists) {
      await s3client.write("cover.jpg", Bun.file("./public/cover.jpg"));
    }
  } catch (error) {
    console.error(`Error checking cover image on S3: ${error}`);
  }
};

// src/generate-feed.ts
var serverUrl = () => Bun.env.IS_TEST ? "https://test.com" : Bun.env.SERVER_URL;
var rssFile = () => Bun.env.IS_TEST ? "./public/rss.test.xml" : "./public/rss.xml";
var xml = (feed2) => Bun.env.IS_TEST ? feed2.buildXml() : feed2.buildXml({ indent: "  " });
var feedOptions = {
  title: "YouTube",
  description: "YouTube personal feed",
  feedUrl: `${serverUrl()}/rss.xml`,
  siteUrl: "https://github.com/uqe/youtube2rss",
  imageUrl: `${serverUrl()}/cover.jpg`,
  author: "Arthur N",
  managingEditor: "arthurn@duck.com",
  generator: "https://github.com/uqe/youtube2rss",
  webMaster: "arthurn@duck.com",
  copyright: "2023 Arthur N",
  language: "ru",
  categories: ["Education", "Self-Improvement"],
  pubDate: new Date(Date.parse("2023-04-16")),
  ttl: 5,
  itunesAuthor: "Arthur N",
  itunesSubtitle: "YouTube personal feed",
  itunesSummary: "YouTube personal feed",
  itunesOwner: { name: "Arthur N", email: "arthurn@duck.com" },
  itunesExplicit: false,
  itunesCategory: [
    {
      text: "Education",
      subcats: [
        {
          text: "Self-Improvement"
        }
      ]
    }
  ],
  itunesImage: `${serverUrl()}/cover.jpg`
};
var generateFeed = async (allVideos) => {
  const feed2 = new Podcast(feedOptions);
  for (const item2 of allVideos) {
    const videoFile = Bun.file(item2.video_path);
    const fileExists = await videoFile.exists();
    if (!fileExists && !Bun.env.IS_TEST) {
      console.log(`File ${item2.video_path} doesn't exist. Skipping...`);
    } else {
      feed2.addItem({
        title: item2.video_name,
        description: item2.video_description ? item2.video_description : "",
        url: `${serverUrl()}/files/${item2.video_id}.mp3`,
        guid: item2.video_id,
        author: "Arthur N",
        date: item2.video_added_date,
        enclosure: !Bun.env.IS_TEST ? {
          url: `${serverUrl()}/files/${item2.video_id}.mp3`,
          file: item2.video_path,
          type: "audio/mp3"
        } : undefined,
        itunesAuthor: "Arthur N",
        itunesExplicit: false,
        itunesSubtitle: item2.video_name,
        itunesSummary: item2.video_name,
        itunesDuration: item2.video_length
      });
    }
  }
  Bun.write(rssFile(), xml(feed2));
  if (isS3Configured()) {
    await uploadXmlToS3(rssFile());
    await isCoverImageExistsOnS3();
  }
};

// src/download.ts
var download = async (videoId, handler) => {
  const outputFilePath = `./public/files/${videoId}.mp3`;
  try {
    if (isVideoExists(videoId)) {
      console.log("Video already exists");
      handler && handler("Video already exists. Find it in the RSS feed.");
      return;
    }
    console.log("Start downloading");
    await import_youtube_dl_exec2.default.exec(`https://youtu.be/watch?v=${videoId}`, {
      extractAudio: true,
      audioFormat: "mp3",
      noCheckCertificates: true,
      noWarnings: true,
      output: outputFilePath,
      preferFreeFormats: true,
      writeInfoJson: false,
      quiet: false,
      embedThumbnail: true
    }, { timeout: 1e5, killSignal: "SIGKILL" }).catch((err) => err);
    console.log("Downloaded successfully");
    const info = await getVideoInfo(videoId);
    if (isS3Configured() && !Bun.env.IS_TEST) {
      await uploadFileOnS3(videoId, outputFilePath);
    }
    await addVideoToDb(info.id, info.title, info.description, info.webpage_url, new Date().toISOString(), outputFilePath, info.duration);
    console.log("Start regenerating RSS feed");
    generateFeed(getAllVideos());
    console.log("Feed regenerated successfully");
    handler && handler("RSS feed was successfully updated.");
  } catch (error) {
    handler && handler("Something went wrong. Please try again later...");
    console.error(error);
  }
};

// src/index.ts
var bot = new import_grammy.Bot(Bun.env.TELEGRAM_BOT_TOKEN);
bot.command("start", (ctx) => ctx.reply("Welcome! Up and running."));
var whiteList = new Set([169125, 1715194386]);
bot.on("message", async (ctx) => {
  const handler = (text) => ctx.reply(text);
  if (!whiteList.has(ctx.message.from.id)) {
    ctx.reply("You are not allowed to use this bot...");
    return;
  }
  if (ctx.message.text) {
    const videoId = getYoutubeVideoId(ctx.message.text);
    if (videoId) {
      ctx.reply("Got it! I'll start downloading the video. Please wait...");
      await download(videoId, handler);
    } else {
      ctx.reply("Please send me a valid YouTube video link.");
    }
  }
});
bot.start();
