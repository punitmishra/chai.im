/**
 * Curated emoji data organized by category
 * ~200 most commonly used emojis for chat applications
 */

export interface EmojiData {
  emoji: string;
  name: string;
  shortcodes: string[];
  keywords: string[];
}

export interface EmojiCategory {
  id: string;
  name: string;
  icon: string;
  emojis: EmojiData[];
}

// Smileys & Emotion
const smileys: EmojiData[] = [
  { emoji: '😀', name: 'grinning face', shortcodes: ['grinning'], keywords: ['happy', 'smile', 'joy'] },
  { emoji: '😃', name: 'grinning face with big eyes', shortcodes: ['smiley'], keywords: ['happy', 'smile', 'joy'] },
  { emoji: '😄', name: 'grinning face with smiling eyes', shortcodes: ['smile'], keywords: ['happy', 'joy', 'laugh'] },
  { emoji: '😁', name: 'beaming face with smiling eyes', shortcodes: ['grin'], keywords: ['happy', 'smile'] },
  { emoji: '😆', name: 'grinning squinting face', shortcodes: ['laughing', 'satisfied'], keywords: ['laugh', 'happy'] },
  { emoji: '😅', name: 'grinning face with sweat', shortcodes: ['sweat_smile'], keywords: ['nervous', 'relief'] },
  { emoji: '🤣', name: 'rolling on the floor laughing', shortcodes: ['rofl'], keywords: ['lol', 'laugh', 'funny'] },
  { emoji: '😂', name: 'face with tears of joy', shortcodes: ['joy'], keywords: ['laugh', 'cry', 'funny', 'lol'] },
  { emoji: '🙂', name: 'slightly smiling face', shortcodes: ['slight_smile'], keywords: ['smile'] },
  { emoji: '🙃', name: 'upside-down face', shortcodes: ['upside_down'], keywords: ['silly', 'sarcasm'] },
  { emoji: '😉', name: 'winking face', shortcodes: ['wink'], keywords: ['flirt', 'joke'] },
  { emoji: '😊', name: 'smiling face with smiling eyes', shortcodes: ['blush'], keywords: ['happy', 'shy', 'cute'] },
  { emoji: '😇', name: 'smiling face with halo', shortcodes: ['innocent'], keywords: ['angel', 'good'] },
  { emoji: '🥰', name: 'smiling face with hearts', shortcodes: ['smiling_face_with_hearts'], keywords: ['love', 'adore'] },
  { emoji: '😍', name: 'smiling face with heart-eyes', shortcodes: ['heart_eyes'], keywords: ['love', 'crush', 'adore'] },
  { emoji: '🤩', name: 'star-struck', shortcodes: ['star_struck'], keywords: ['excited', 'amazing', 'wow'] },
  { emoji: '😘', name: 'face blowing a kiss', shortcodes: ['kissing_heart'], keywords: ['love', 'kiss', 'flirt'] },
  { emoji: '😋', name: 'face savoring food', shortcodes: ['yum'], keywords: ['delicious', 'tasty'] },
  { emoji: '😛', name: 'face with tongue', shortcodes: ['stuck_out_tongue'], keywords: ['playful', 'silly'] },
  { emoji: '😜', name: 'winking face with tongue', shortcodes: ['stuck_out_tongue_winking_eye'], keywords: ['playful', 'joke'] },
  { emoji: '🤪', name: 'zany face', shortcodes: ['zany_face'], keywords: ['crazy', 'wild', 'silly'] },
  { emoji: '🤗', name: 'smiling face with open hands', shortcodes: ['hugs'], keywords: ['hug', 'friendly'] },
  { emoji: '🤔', name: 'thinking face', shortcodes: ['thinking'], keywords: ['hmm', 'consider', 'ponder'] },
  { emoji: '🤫', name: 'shushing face', shortcodes: ['shushing_face'], keywords: ['quiet', 'secret'] },
  { emoji: '🤭', name: 'face with hand over mouth', shortcodes: ['hand_over_mouth'], keywords: ['oops', 'giggle'] },
  { emoji: '😏', name: 'smirking face', shortcodes: ['smirk'], keywords: ['smug', 'flirt'] },
  { emoji: '😒', name: 'unamused face', shortcodes: ['unamused'], keywords: ['annoyed', 'bored'] },
  { emoji: '🙄', name: 'face with rolling eyes', shortcodes: ['roll_eyes'], keywords: ['annoyed', 'frustrated'] },
  { emoji: '😬', name: 'grimacing face', shortcodes: ['grimacing'], keywords: ['awkward', 'nervous'] },
  { emoji: '😌', name: 'relieved face', shortcodes: ['relieved'], keywords: ['relaxed', 'calm'] },
  { emoji: '😔', name: 'pensive face', shortcodes: ['pensive'], keywords: ['sad', 'thoughtful'] },
  { emoji: '😪', name: 'sleepy face', shortcodes: ['sleepy'], keywords: ['tired', 'sleep'] },
  { emoji: '😴', name: 'sleeping face', shortcodes: ['sleeping'], keywords: ['sleep', 'zzz', 'tired'] },
  { emoji: '😷', name: 'face with medical mask', shortcodes: ['mask'], keywords: ['sick', 'covid'] },
  { emoji: '🤒', name: 'face with thermometer', shortcodes: ['thermometer_face'], keywords: ['sick', 'fever'] },
  { emoji: '🤕', name: 'face with head-bandage', shortcodes: ['head_bandage'], keywords: ['hurt', 'injured'] },
  { emoji: '🤢', name: 'nauseated face', shortcodes: ['nauseated_face'], keywords: ['sick', 'gross'] },
  { emoji: '🤮', name: 'face vomiting', shortcodes: ['vomiting_face'], keywords: ['sick', 'gross'] },
  { emoji: '🥵', name: 'hot face', shortcodes: ['hot_face'], keywords: ['hot', 'sweating'] },
  { emoji: '🥶', name: 'cold face', shortcodes: ['cold_face'], keywords: ['cold', 'freezing'] },
  { emoji: '🥴', name: 'woozy face', shortcodes: ['woozy_face'], keywords: ['drunk', 'dizzy'] },
  { emoji: '😵', name: 'face with crossed-out eyes', shortcodes: ['dizzy_face'], keywords: ['dizzy', 'dead'] },
  { emoji: '🤯', name: 'exploding head', shortcodes: ['exploding_head'], keywords: ['mind blown', 'shocked'] },
  { emoji: '🥳', name: 'partying face', shortcodes: ['partying_face'], keywords: ['party', 'celebrate'] },
  { emoji: '😎', name: 'smiling face with sunglasses', shortcodes: ['sunglasses'], keywords: ['cool', 'awesome'] },
  { emoji: '🤓', name: 'nerd face', shortcodes: ['nerd'], keywords: ['geek', 'smart'] },
  { emoji: '🧐', name: 'face with monocle', shortcodes: ['monocle_face'], keywords: ['curious', 'investigate'] },
  { emoji: '😕', name: 'confused face', shortcodes: ['confused'], keywords: ['puzzled', 'uncertain'] },
  { emoji: '😟', name: 'worried face', shortcodes: ['worried'], keywords: ['anxious', 'concerned'] },
  { emoji: '🙁', name: 'slightly frowning face', shortcodes: ['slightly_frowning_face'], keywords: ['sad', 'unhappy'] },
  { emoji: '😮', name: 'face with open mouth', shortcodes: ['open_mouth'], keywords: ['surprised', 'shocked'] },
  { emoji: '😲', name: 'astonished face', shortcodes: ['astonished'], keywords: ['shocked', 'amazed'] },
  { emoji: '😳', name: 'flushed face', shortcodes: ['flushed'], keywords: ['embarrassed', 'shy'] },
  { emoji: '🥺', name: 'pleading face', shortcodes: ['pleading_face'], keywords: ['puppy eyes', 'please'] },
  { emoji: '😢', name: 'crying face', shortcodes: ['cry'], keywords: ['sad', 'tears'] },
  { emoji: '😭', name: 'loudly crying face', shortcodes: ['sob'], keywords: ['cry', 'sad', 'tears'] },
  { emoji: '😱', name: 'face screaming in fear', shortcodes: ['scream'], keywords: ['scared', 'horror'] },
  { emoji: '😤', name: 'face with steam from nose', shortcodes: ['triumph'], keywords: ['angry', 'frustrated'] },
  { emoji: '😡', name: 'pouting face', shortcodes: ['rage', 'pout'], keywords: ['angry', 'mad'] },
  { emoji: '😠', name: 'angry face', shortcodes: ['angry'], keywords: ['mad', 'annoyed'] },
  { emoji: '🤬', name: 'face with symbols on mouth', shortcodes: ['cursing_face'], keywords: ['angry', 'swearing'] },
  { emoji: '😈', name: 'smiling face with horns', shortcodes: ['smiling_imp'], keywords: ['devil', 'evil', 'mischievous'] },
  { emoji: '👿', name: 'angry face with horns', shortcodes: ['imp'], keywords: ['devil', 'angry'] },
  { emoji: '💀', name: 'skull', shortcodes: ['skull'], keywords: ['dead', 'death'] },
  { emoji: '💩', name: 'pile of poo', shortcodes: ['poop', 'shit'], keywords: ['crap', 'poo'] },
  { emoji: '🤡', name: 'clown face', shortcodes: ['clown'], keywords: ['clown', 'silly'] },
  { emoji: '👻', name: 'ghost', shortcodes: ['ghost'], keywords: ['halloween', 'spooky'] },
  { emoji: '👽', name: 'alien', shortcodes: ['alien'], keywords: ['ufo', 'space'] },
  { emoji: '🤖', name: 'robot', shortcodes: ['robot'], keywords: ['bot', 'machine'] },
  { emoji: '💯', name: 'hundred points', shortcodes: ['100'], keywords: ['perfect', 'score'] },
  { emoji: '💥', name: 'collision', shortcodes: ['boom', 'collision'], keywords: ['explosion', 'bang'] },
  { emoji: '💫', name: 'dizzy', shortcodes: ['dizzy'], keywords: ['stars', 'sparkle'] },
  { emoji: '💦', name: 'sweat droplets', shortcodes: ['sweat_drops'], keywords: ['water', 'workout'] },
  { emoji: '💤', name: 'zzz', shortcodes: ['zzz'], keywords: ['sleep', 'tired'] },
];

// People & Body
const people: EmojiData[] = [
  { emoji: '👋', name: 'waving hand', shortcodes: ['wave'], keywords: ['hello', 'goodbye', 'hi'] },
  { emoji: '🤚', name: 'raised back of hand', shortcodes: ['raised_back_of_hand'], keywords: ['stop', 'hand'] },
  { emoji: '✋', name: 'raised hand', shortcodes: ['hand', 'raised_hand'], keywords: ['stop', 'high five'] },
  { emoji: '🖖', name: 'vulcan salute', shortcodes: ['vulcan'], keywords: ['spock', 'star trek'] },
  { emoji: '👌', name: 'OK hand', shortcodes: ['ok_hand'], keywords: ['perfect', 'okay'] },
  { emoji: '🤌', name: 'pinched fingers', shortcodes: ['pinched_fingers'], keywords: ['italian', 'chef kiss'] },
  { emoji: '✌️', name: 'victory hand', shortcodes: ['v', 'peace'], keywords: ['peace', 'victory'] },
  { emoji: '🤞', name: 'crossed fingers', shortcodes: ['crossed_fingers'], keywords: ['luck', 'hope'] },
  { emoji: '🤟', name: 'love-you gesture', shortcodes: ['love_you_gesture'], keywords: ['love', 'rock'] },
  { emoji: '🤘', name: 'sign of the horns', shortcodes: ['metal'], keywords: ['rock', 'metal'] },
  { emoji: '🤙', name: 'call me hand', shortcodes: ['call_me'], keywords: ['shaka', 'hang loose'] },
  { emoji: '👈', name: 'backhand index pointing left', shortcodes: ['point_left'], keywords: ['left', 'direction'] },
  { emoji: '👉', name: 'backhand index pointing right', shortcodes: ['point_right'], keywords: ['right', 'direction'] },
  { emoji: '👆', name: 'backhand index pointing up', shortcodes: ['point_up'], keywords: ['up', 'direction'] },
  { emoji: '👇', name: 'backhand index pointing down', shortcodes: ['point_down'], keywords: ['down', 'direction'] },
  { emoji: '👍', name: 'thumbs up', shortcodes: ['thumbsup', '+1', 'thumbs_up'], keywords: ['yes', 'good', 'like', 'approve'] },
  { emoji: '👎', name: 'thumbs down', shortcodes: ['thumbsdown', '-1', 'thumbs_down'], keywords: ['no', 'bad', 'dislike'] },
  { emoji: '✊', name: 'raised fist', shortcodes: ['fist'], keywords: ['power', 'punch'] },
  { emoji: '👊', name: 'oncoming fist', shortcodes: ['punch'], keywords: ['punch', 'fist bump'] },
  { emoji: '🤛', name: 'left-facing fist', shortcodes: ['left_fist'], keywords: ['fist bump'] },
  { emoji: '🤜', name: 'right-facing fist', shortcodes: ['right_fist'], keywords: ['fist bump'] },
  { emoji: '👏', name: 'clapping hands', shortcodes: ['clap'], keywords: ['applause', 'bravo'] },
  { emoji: '🙌', name: 'raising hands', shortcodes: ['raised_hands'], keywords: ['celebration', 'hooray'] },
  { emoji: '👐', name: 'open hands', shortcodes: ['open_hands'], keywords: ['hug', 'jazz hands'] },
  { emoji: '🤝', name: 'handshake', shortcodes: ['handshake'], keywords: ['deal', 'agreement'] },
  { emoji: '🙏', name: 'folded hands', shortcodes: ['pray'], keywords: ['please', 'thank you', 'hope'] },
  { emoji: '💪', name: 'flexed biceps', shortcodes: ['muscle'], keywords: ['strong', 'flex', 'workout'] },
  { emoji: '🙈', name: 'see-no-evil monkey', shortcodes: ['see_no_evil'], keywords: ['monkey', 'shy'] },
  { emoji: '🙉', name: 'hear-no-evil monkey', shortcodes: ['hear_no_evil'], keywords: ['monkey', 'ignore'] },
  { emoji: '🙊', name: 'speak-no-evil monkey', shortcodes: ['speak_no_evil'], keywords: ['monkey', 'secret'] },
];

// Animals & Nature
const animals: EmojiData[] = [
  { emoji: '🐶', name: 'dog face', shortcodes: ['dog'], keywords: ['puppy', 'pet'] },
  { emoji: '🐱', name: 'cat face', shortcodes: ['cat'], keywords: ['kitty', 'pet'] },
  { emoji: '🐭', name: 'mouse face', shortcodes: ['mouse'], keywords: ['rodent'] },
  { emoji: '🐹', name: 'hamster', shortcodes: ['hamster'], keywords: ['pet', 'rodent'] },
  { emoji: '🐰', name: 'rabbit face', shortcodes: ['rabbit'], keywords: ['bunny', 'easter'] },
  { emoji: '🦊', name: 'fox', shortcodes: ['fox'], keywords: ['animal'] },
  { emoji: '🐻', name: 'bear', shortcodes: ['bear'], keywords: ['animal', 'teddy'] },
  { emoji: '🐼', name: 'panda', shortcodes: ['panda'], keywords: ['animal', 'bear'] },
  { emoji: '🐨', name: 'koala', shortcodes: ['koala'], keywords: ['animal', 'australia'] },
  { emoji: '🐯', name: 'tiger face', shortcodes: ['tiger'], keywords: ['animal', 'cat'] },
  { emoji: '🦁', name: 'lion', shortcodes: ['lion'], keywords: ['animal', 'king'] },
  { emoji: '🐮', name: 'cow face', shortcodes: ['cow'], keywords: ['animal', 'farm'] },
  { emoji: '🐷', name: 'pig face', shortcodes: ['pig'], keywords: ['animal', 'farm'] },
  { emoji: '🐸', name: 'frog', shortcodes: ['frog'], keywords: ['animal', 'amphibian'] },
  { emoji: '🐵', name: 'monkey face', shortcodes: ['monkey_face'], keywords: ['animal', 'ape'] },
  { emoji: '🐔', name: 'chicken', shortcodes: ['chicken'], keywords: ['animal', 'farm', 'bird'] },
  { emoji: '🐧', name: 'penguin', shortcodes: ['penguin'], keywords: ['animal', 'bird', 'cold'] },
  { emoji: '🐦', name: 'bird', shortcodes: ['bird'], keywords: ['animal', 'fly'] },
  { emoji: '🦆', name: 'duck', shortcodes: ['duck'], keywords: ['animal', 'bird'] },
  { emoji: '🦅', name: 'eagle', shortcodes: ['eagle'], keywords: ['animal', 'bird', 'america'] },
  { emoji: '🦉', name: 'owl', shortcodes: ['owl'], keywords: ['animal', 'bird', 'night'] },
  { emoji: '🦄', name: 'unicorn', shortcodes: ['unicorn'], keywords: ['animal', 'magic', 'fantasy'] },
  { emoji: '🐝', name: 'honeybee', shortcodes: ['bee'], keywords: ['insect', 'honey'] },
  { emoji: '🦋', name: 'butterfly', shortcodes: ['butterfly'], keywords: ['insect', 'beautiful'] },
  { emoji: '🐌', name: 'snail', shortcodes: ['snail'], keywords: ['animal', 'slow'] },
  { emoji: '🐙', name: 'octopus', shortcodes: ['octopus'], keywords: ['animal', 'sea'] },
  { emoji: '🐬', name: 'dolphin', shortcodes: ['dolphin'], keywords: ['animal', 'sea'] },
  { emoji: '🐳', name: 'spouting whale', shortcodes: ['whale'], keywords: ['animal', 'sea'] },
  { emoji: '🐢', name: 'turtle', shortcodes: ['turtle'], keywords: ['animal', 'slow'] },
  { emoji: '🐍', name: 'snake', shortcodes: ['snake'], keywords: ['animal', 'reptile'] },
  { emoji: '🦖', name: 'T-Rex', shortcodes: ['t-rex', 'dinosaur'], keywords: ['dinosaur', 'extinct'] },
  { emoji: '🌸', name: 'cherry blossom', shortcodes: ['cherry_blossom'], keywords: ['flower', 'spring'] },
  { emoji: '🌹', name: 'rose', shortcodes: ['rose'], keywords: ['flower', 'love'] },
  { emoji: '🌻', name: 'sunflower', shortcodes: ['sunflower'], keywords: ['flower', 'summer'] },
  { emoji: '🌴', name: 'palm tree', shortcodes: ['palm_tree'], keywords: ['tree', 'tropical', 'beach'] },
  { emoji: '🍀', name: 'four leaf clover', shortcodes: ['four_leaf_clover'], keywords: ['luck', 'irish'] },
];

// Food & Drink
const food: EmojiData[] = [
  { emoji: '🍎', name: 'red apple', shortcodes: ['apple'], keywords: ['fruit', 'food'] },
  { emoji: '🍊', name: 'tangerine', shortcodes: ['orange', 'tangerine'], keywords: ['fruit', 'food'] },
  { emoji: '🍋', name: 'lemon', shortcodes: ['lemon'], keywords: ['fruit', 'sour'] },
  { emoji: '🍌', name: 'banana', shortcodes: ['banana'], keywords: ['fruit', 'food'] },
  { emoji: '🍉', name: 'watermelon', shortcodes: ['watermelon'], keywords: ['fruit', 'summer'] },
  { emoji: '🍇', name: 'grapes', shortcodes: ['grapes'], keywords: ['fruit', 'wine'] },
  { emoji: '🍓', name: 'strawberry', shortcodes: ['strawberry'], keywords: ['fruit', 'berry'] },
  { emoji: '🍑', name: 'peach', shortcodes: ['peach'], keywords: ['fruit', 'food'] },
  { emoji: '🍍', name: 'pineapple', shortcodes: ['pineapple'], keywords: ['fruit', 'tropical'] },
  { emoji: '🥑', name: 'avocado', shortcodes: ['avocado'], keywords: ['fruit', 'guacamole'] },
  { emoji: '🍕', name: 'pizza', shortcodes: ['pizza'], keywords: ['food', 'italian'] },
  { emoji: '🍔', name: 'hamburger', shortcodes: ['hamburger', 'burger'], keywords: ['food', 'fast food'] },
  { emoji: '🍟', name: 'french fries', shortcodes: ['fries'], keywords: ['food', 'fast food'] },
  { emoji: '🌮', name: 'taco', shortcodes: ['taco'], keywords: ['food', 'mexican'] },
  { emoji: '🌯', name: 'burrito', shortcodes: ['burrito'], keywords: ['food', 'mexican'] },
  { emoji: '🍣', name: 'sushi', shortcodes: ['sushi'], keywords: ['food', 'japanese'] },
  { emoji: '🍜', name: 'steaming bowl', shortcodes: ['ramen'], keywords: ['food', 'noodles', 'soup'] },
  { emoji: '🍝', name: 'spaghetti', shortcodes: ['spaghetti', 'pasta'], keywords: ['food', 'italian'] },
  { emoji: '🍰', name: 'shortcake', shortcodes: ['cake'], keywords: ['dessert', 'sweet'] },
  { emoji: '🎂', name: 'birthday cake', shortcodes: ['birthday'], keywords: ['cake', 'celebration'] },
  { emoji: '🍩', name: 'doughnut', shortcodes: ['doughnut', 'donut'], keywords: ['dessert', 'sweet'] },
  { emoji: '🍪', name: 'cookie', shortcodes: ['cookie'], keywords: ['dessert', 'sweet'] },
  { emoji: '🍫', name: 'chocolate bar', shortcodes: ['chocolate'], keywords: ['candy', 'sweet'] },
  { emoji: '🍦', name: 'soft ice cream', shortcodes: ['icecream'], keywords: ['dessert', 'cold'] },
  { emoji: '☕', name: 'hot beverage', shortcodes: ['coffee'], keywords: ['drink', 'tea', 'caffeine'] },
  { emoji: '🍵', name: 'teacup without handle', shortcodes: ['tea'], keywords: ['drink', 'hot'] },
  { emoji: '🍺', name: 'beer mug', shortcodes: ['beer'], keywords: ['drink', 'alcohol'] },
  { emoji: '🍻', name: 'clinking beer mugs', shortcodes: ['beers'], keywords: ['drink', 'alcohol', 'cheers'] },
  { emoji: '🥂', name: 'clinking glasses', shortcodes: ['champagne', 'cheers'], keywords: ['drink', 'celebrate'] },
  { emoji: '🍷', name: 'wine glass', shortcodes: ['wine'], keywords: ['drink', 'alcohol'] },
];

// Activities
const activities: EmojiData[] = [
  { emoji: '⚽', name: 'soccer ball', shortcodes: ['soccer'], keywords: ['sport', 'football'] },
  { emoji: '🏀', name: 'basketball', shortcodes: ['basketball'], keywords: ['sport', 'ball'] },
  { emoji: '🏈', name: 'american football', shortcodes: ['football'], keywords: ['sport', 'nfl'] },
  { emoji: '⚾', name: 'baseball', shortcodes: ['baseball'], keywords: ['sport', 'ball'] },
  { emoji: '🎾', name: 'tennis', shortcodes: ['tennis'], keywords: ['sport', 'ball'] },
  { emoji: '🎮', name: 'video game', shortcodes: ['video_game'], keywords: ['game', 'controller'] },
  { emoji: '🎯', name: 'direct hit', shortcodes: ['dart', 'target'], keywords: ['game', 'bullseye'] },
  { emoji: '🎲', name: 'game die', shortcodes: ['dice'], keywords: ['game', 'chance'] },
  { emoji: '🎨', name: 'artist palette', shortcodes: ['art'], keywords: ['paint', 'creative'] },
  { emoji: '🎬', name: 'clapper board', shortcodes: ['clapper'], keywords: ['movie', 'film'] },
  { emoji: '🎤', name: 'microphone', shortcodes: ['microphone'], keywords: ['music', 'sing'] },
  { emoji: '🎧', name: 'headphone', shortcodes: ['headphones'], keywords: ['music', 'audio'] },
  { emoji: '🎸', name: 'guitar', shortcodes: ['guitar'], keywords: ['music', 'rock'] },
  { emoji: '🎹', name: 'musical keyboard', shortcodes: ['piano'], keywords: ['music', 'instrument'] },
  { emoji: '🏆', name: 'trophy', shortcodes: ['trophy'], keywords: ['win', 'champion'] },
  { emoji: '🥇', name: 'first place medal', shortcodes: ['first_place', 'gold_medal'], keywords: ['win', 'champion'] },
];

// Travel & Places
const travel: EmojiData[] = [
  { emoji: '🚗', name: 'automobile', shortcodes: ['car'], keywords: ['vehicle', 'drive'] },
  { emoji: '🚕', name: 'taxi', shortcodes: ['taxi'], keywords: ['vehicle', 'cab'] },
  { emoji: '🚌', name: 'bus', shortcodes: ['bus'], keywords: ['vehicle', 'public'] },
  { emoji: '✈️', name: 'airplane', shortcodes: ['airplane'], keywords: ['travel', 'flight'] },
  { emoji: '🚀', name: 'rocket', shortcodes: ['rocket'], keywords: ['space', 'launch'] },
  { emoji: '🛸', name: 'flying saucer', shortcodes: ['ufo'], keywords: ['space', 'alien'] },
  { emoji: '🚁', name: 'helicopter', shortcodes: ['helicopter'], keywords: ['vehicle', 'fly'] },
  { emoji: '⛵', name: 'sailboat', shortcodes: ['sailboat'], keywords: ['boat', 'water'] },
  { emoji: '🚢', name: 'ship', shortcodes: ['ship'], keywords: ['boat', 'cruise'] },
  { emoji: '🏠', name: 'house', shortcodes: ['house'], keywords: ['home', 'building'] },
  { emoji: '🏢', name: 'office building', shortcodes: ['office'], keywords: ['building', 'work'] },
  { emoji: '🏥', name: 'hospital', shortcodes: ['hospital'], keywords: ['building', 'health'] },
  { emoji: '🏫', name: 'school', shortcodes: ['school'], keywords: ['building', 'education'] },
  { emoji: '🏰', name: 'castle', shortcodes: ['castle'], keywords: ['building', 'royal'] },
  { emoji: '🗽', name: 'Statue of Liberty', shortcodes: ['statue_of_liberty'], keywords: ['landmark', 'usa'] },
  { emoji: '🏖️', name: 'beach with umbrella', shortcodes: ['beach'], keywords: ['vacation', 'summer'] },
  { emoji: '🌅', name: 'sunrise', shortcodes: ['sunrise'], keywords: ['nature', 'morning'] },
  { emoji: '🌌', name: 'milky way', shortcodes: ['milky_way'], keywords: ['space', 'stars'] },
];

// Objects
const objects: EmojiData[] = [
  { emoji: '📱', name: 'mobile phone', shortcodes: ['iphone', 'phone'], keywords: ['device', 'cell'] },
  { emoji: '💻', name: 'laptop', shortcodes: ['laptop', 'computer'], keywords: ['device', 'work'] },
  { emoji: '🖥️', name: 'desktop computer', shortcodes: ['desktop'], keywords: ['device', 'work'] },
  { emoji: '💡', name: 'light bulb', shortcodes: ['bulb', 'idea'], keywords: ['light', 'idea'] },
  { emoji: '📚', name: 'books', shortcodes: ['books'], keywords: ['read', 'study'] },
  { emoji: '📝', name: 'memo', shortcodes: ['memo', 'pencil'], keywords: ['write', 'note'] },
  { emoji: '🔒', name: 'locked', shortcodes: ['lock'], keywords: ['security', 'private'] },
  { emoji: '🔑', name: 'key', shortcodes: ['key'], keywords: ['lock', 'security'] },
  { emoji: '🔨', name: 'hammer', shortcodes: ['hammer'], keywords: ['tool', 'build'] },
  { emoji: '🔧', name: 'wrench', shortcodes: ['wrench'], keywords: ['tool', 'fix'] },
  { emoji: '⚙️', name: 'gear', shortcodes: ['gear'], keywords: ['settings', 'config'] },
  { emoji: '💎', name: 'gem stone', shortcodes: ['gem', 'diamond'], keywords: ['jewel', 'precious'] },
  { emoji: '💰', name: 'money bag', shortcodes: ['moneybag'], keywords: ['money', 'rich'] },
  { emoji: '💵', name: 'dollar banknote', shortcodes: ['dollar'], keywords: ['money', 'cash'] },
  { emoji: '🎁', name: 'wrapped gift', shortcodes: ['gift'], keywords: ['present', 'birthday'] },
  { emoji: '🎉', name: 'party popper', shortcodes: ['tada', 'party'], keywords: ['celebration', 'congrats'] },
  { emoji: '🎊', name: 'confetti ball', shortcodes: ['confetti_ball'], keywords: ['celebration', 'party'] },
];

// Symbols
const symbols: EmojiData[] = [
  { emoji: '❤️', name: 'red heart', shortcodes: ['heart'], keywords: ['love', 'like'] },
  { emoji: '🧡', name: 'orange heart', shortcodes: ['orange_heart'], keywords: ['love', 'like'] },
  { emoji: '💛', name: 'yellow heart', shortcodes: ['yellow_heart'], keywords: ['love', 'friendship'] },
  { emoji: '💚', name: 'green heart', shortcodes: ['green_heart'], keywords: ['love', 'nature'] },
  { emoji: '💙', name: 'blue heart', shortcodes: ['blue_heart'], keywords: ['love', 'trust'] },
  { emoji: '💜', name: 'purple heart', shortcodes: ['purple_heart'], keywords: ['love'] },
  { emoji: '🖤', name: 'black heart', shortcodes: ['black_heart'], keywords: ['love', 'dark'] },
  { emoji: '🤍', name: 'white heart', shortcodes: ['white_heart'], keywords: ['love', 'pure'] },
  { emoji: '💔', name: 'broken heart', shortcodes: ['broken_heart'], keywords: ['sad', 'love'] },
  { emoji: '💕', name: 'two hearts', shortcodes: ['two_hearts'], keywords: ['love', 'romance'] },
  { emoji: '💖', name: 'sparkling heart', shortcodes: ['sparkling_heart'], keywords: ['love', 'shine'] },
  { emoji: '✨', name: 'sparkles', shortcodes: ['sparkles'], keywords: ['shine', 'magic'] },
  { emoji: '⚡', name: 'high voltage', shortcodes: ['zap'], keywords: ['lightning', 'power'] },
  { emoji: '🔥', name: 'fire', shortcodes: ['fire'], keywords: ['hot', 'lit'] },
  { emoji: '💧', name: 'droplet', shortcodes: ['droplet'], keywords: ['water', 'tear'] },
  { emoji: '🌈', name: 'rainbow', shortcodes: ['rainbow'], keywords: ['color', 'pride'] },
  { emoji: '☀️', name: 'sun', shortcodes: ['sunny'], keywords: ['weather', 'bright'] },
  { emoji: '🌙', name: 'crescent moon', shortcodes: ['crescent_moon'], keywords: ['night', 'sleep'] },
  { emoji: '⭐', name: 'star', shortcodes: ['star'], keywords: ['favorite', 'night'] },
  { emoji: '🌟', name: 'glowing star', shortcodes: ['star2'], keywords: ['sparkle', 'shine'] },
  { emoji: '💬', name: 'speech balloon', shortcodes: ['speech_balloon'], keywords: ['talk', 'chat'] },
  { emoji: '💭', name: 'thought balloon', shortcodes: ['thought_balloon'], keywords: ['think', 'idea'] },
  { emoji: '✅', name: 'check mark button', shortcodes: ['white_check_mark'], keywords: ['yes', 'done'] },
  { emoji: '❌', name: 'cross mark', shortcodes: ['x'], keywords: ['no', 'wrong'] },
  { emoji: '❓', name: 'question mark', shortcodes: ['question'], keywords: ['ask', 'what'] },
  { emoji: '❗', name: 'exclamation mark', shortcodes: ['exclamation'], keywords: ['important', 'alert'] },
  { emoji: '🔔', name: 'bell', shortcodes: ['bell'], keywords: ['notification', 'alert'] },
  { emoji: '🎵', name: 'musical note', shortcodes: ['musical_note'], keywords: ['music', 'song'] },
  { emoji: '🎶', name: 'musical notes', shortcodes: ['notes'], keywords: ['music', 'song'] },
];

// All categories
export const emojiCategories: EmojiCategory[] = [
  { id: 'smileys', name: 'Smileys & Emotion', icon: '😀', emojis: smileys },
  { id: 'people', name: 'People & Body', icon: '👋', emojis: people },
  { id: 'animals', name: 'Animals & Nature', icon: '🐱', emojis: animals },
  { id: 'food', name: 'Food & Drink', icon: '🍔', emojis: food },
  { id: 'activities', name: 'Activities', icon: '⚽', emojis: activities },
  { id: 'travel', name: 'Travel & Places', icon: '🚗', emojis: travel },
  { id: 'objects', name: 'Objects', icon: '💡', emojis: objects },
  { id: 'symbols', name: 'Symbols', icon: '❤️', emojis: symbols },
];

// Flat list of all emojis for search
export const allEmojis: EmojiData[] = emojiCategories.flatMap((cat) => cat.emojis);

// Shortcode to emoji map for quick lookup
export const shortcodeToEmoji: Map<string, string> = new Map(
  allEmojis.flatMap((e) => e.shortcodes.map((sc) => [sc, e.emoji]))
);

// Quick reaction emojis
export const quickReactions: EmojiData[] = [
  { emoji: '👍', name: 'thumbs up', shortcodes: ['thumbsup', '+1'], keywords: ['yes', 'good', 'like'] },
  { emoji: '😂', name: 'face with tears of joy', shortcodes: ['joy'], keywords: ['laugh', 'funny'] },
  { emoji: '❤️', name: 'red heart', shortcodes: ['heart'], keywords: ['love', 'like'] },
  { emoji: '😮', name: 'face with open mouth', shortcodes: ['open_mouth'], keywords: ['surprised', 'wow'] },
  { emoji: '😢', name: 'crying face', shortcodes: ['cry'], keywords: ['sad', 'tears'] },
  { emoji: '😡', name: 'pouting face', shortcodes: ['rage'], keywords: ['angry', 'mad'] },
];
