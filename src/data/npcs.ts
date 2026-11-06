import { AWAY, type NpcDef } from '../engine/social/types';

/**
 * The villagers. Everything about a person is here: where they live, their day, what they like, and what they say.
 * Dialogue rules are tried in order and the first whose conditions hold is used; `once` rules are used one time.
 * Times are minutes since midnight (`h(9)` is 9:00 am).
 */

const h = (hour: number, minute = 0): number => hour * 60 + minute;

const GREEN = 'willowbrook.village_green';
const FARM = 'willowbrook.home_farm';
const STORE = 'willowbrook.general_store';
const WILLAS_HOME = 'willowbrook.willas_cottage';
const TOBIAS_HOME = 'willowbrook.tobias_cottage';
const RIVER = 'willowbrook.riverbank';
const MUSEUM_MAP = 'willowbrook.museum';
const LODGE = 'marlow.lodge';

export const WILLA: NpcDef = {
  id: 'willa',
  name: 'Willa Thorne',
  role: 'Seed seller',
  about: 'Came to Willowbrook with one bag of seeds and a lot of stubbornness. Knows every soil in the valley by its smell.',
  sprite: 'willa',
  home: GREEN,
  birthday: { season: 'spring', day: 14 },
  schedule: [
    { from: h(6), map: GREEN, x: 30, y: 10, facing: 'down' }, // outside her door, with her morning tea
    { from: h(8), map: FARM, x: 22, y: 19, facing: 'left', serves: 'seed_stall' }, // walks the road to mind her stall
    { from: h(17), map: GREEN, x: 19, y: 16, facing: 'up' }, // an evening by the fountain
    { from: h(20), map: GREEN, x: 30, y: 10, facing: 'down' },
    { from: h(21), map: WILLAS_HOME, x: 3, y: 5, facing: 'right' }, // home for the night
  ],
  tastes: { loves: ['sunflower', 'pumpkin'], likes: ['strawberry', 'tomato'], dislikes: ['radish'], hates: ['coal'] },
  greetings: [
    {
      id: 'willa.first',
      when: [{ kind: 'firstMeeting' }],
      lines: ["Oh! You must be the new farmer. I'm Willa Thorne. I keep the seed stall.", "Come by between nine and five. And do visit the Village Green when you can: Tobias will want to meet you."],
    },
    { id: 'willa.birthday', when: [{ kind: 'birthday' }], lines: ["It's my birthday, would you believe? Nobody here ever remembers. Well. Hello!"] },
    { id: 'willa.close', when: [{ kind: 'friendship', atLeast: 6 }], lines: ['There you are! My favourite farmer.'] },
    { id: 'willa.afternoon', when: [{ kind: 'time', from: h(14), to: h(24) }], lines: ["Afternoon! It's gone quiet, so I'm glad of the company."] },
    { id: 'willa.morning', lines: ['Good morning! Seeds, feed, or just a chat?'] },
  ],
  chats: [
    {
      id: 'willa.story',
      once: true,
      when: [{ kind: 'friendship', atLeast: 3 }],
      lines: ['I came here with one bag of seeds and a great deal of stubbornness.', "The seeds are long gone. The stubbornness, I'm pleased to say, is going strong."],
    },
    { id: 'willa.hens', when: [{ kind: 'quest', id: 'a_good_first_crop', status: 'done' }], lines: ['How are the hens settling in? They are better company than most people. They talk back, and they never mind if you do not answer.'] },
    { id: 'willa.spring', when: [{ kind: 'season', is: ['spring'] }], lines: ["Spring is for radishes and hope. Plant them thick, water them well, and don't fuss."] },
    { id: 'willa.summer', when: [{ kind: 'season', is: ['summer'] }], lines: ['Tomatoes love the heat. So do I, but only from a shady spot.'] },
    { id: 'willa.autumn', when: [{ kind: 'season', is: ['autumn'] }], lines: ["Pumpkins! Give them room and time, and they'll repay you tenfold."] },
    { id: 'willa.winter', when: [{ kind: 'season', is: ['winter'] }], lines: ['Nothing grows now, so I read my seed catalogues by the fire and dream about spring.'] },
    { id: 'willa.default', lines: ['The soil here is good. You can feel it between your fingers.'] },
  ],
  reactions: {
    loved: ['Oh! You remembered. This is wonderful.', 'It will sit proudly on my windowsill.'],
    liked: ['How thoughtful. Thank you!'],
    neutral: ["Thank you. That's kind of you."],
    disliked: ['Oh. Um. Thank you, I suppose.'],
    hated: ['...You did not.'],
  },
  birthdayThanks: ["And on my birthday of all days. You've made my whole year."],
  rewards: [
    { hearts: 2, message: "Here, a few tomato seeds. They'll do well come summer.", items: [{ id: 'tomato_seeds', count: 5 }] },
    { hearts: 5, message: 'A little something for a good friend.', money: 200 },
    { hearts: 8, message: "These are from my best pumpkins. I'd be honoured if you grew them.", items: [{ id: 'pumpkin_seeds', count: 4 }] },
  ],
  quests: ['welcome_to_the_green', 'a_good_first_crop', 'a_feathered_friend', 'a_proper_meal'],
};

export const TOBIAS: NpcDef = {
  id: 'tobias',
  name: 'Tobias Marsh',
  role: 'Retired miller',
  about: "Ground the valley's flour for forty years, until the river changed its course. Now he walks it instead, and misses nothing.",
  sprite: 'tobias',
  home: GREEN,
  birthday: { season: 'summer', day: 3 },
  schedule: [
    { from: h(6), map: GREEN, x: 8, y: 10, facing: 'down' }, // on his doorstep
    { from: h(6), map: TOBIAS_HOME, x: 6, y: 4, facing: 'left', when: 'rain' }, // ...unless it is raining: he stays in all day
    { from: h(9, 30), map: GREEN, x: 23, y: 13, facing: 'up' }, // the bench on the green
    { from: h(9, 30), map: TOBIAS_HOME, x: 6, y: 4, facing: 'left', when: 'rain' },
    { from: h(11), map: FARM, x: 42, y: 22, facing: 'up' }, // watching the river from the bridge
    { from: h(11), map: TOBIAS_HOME, x: 6, y: 4, facing: 'left', when: 'rain' },
    { from: h(13), map: GREEN, x: 20, y: 16, facing: 'up' }, // the fountain
    { from: h(13), map: TOBIAS_HOME, x: 6, y: 4, facing: 'left', when: 'rain' },
    { from: h(18), map: GREEN, x: 8, y: 10, facing: 'down' },
    { from: h(18), map: TOBIAS_HOME, x: 6, y: 4, facing: 'left', when: 'rain' },
    { from: h(21), map: TOBIAS_HOME, x: 6, y: 4, facing: 'left' }, // home for the night
  ],
  tastes: { loves: ['strawberry', 'egg'], likes: ['radish', 'tomato'], dislikes: ['sunflower'], hates: [] },
  greetings: [
    {
      id: 'tobias.first',
      when: [{ kind: 'firstMeeting' }],
      lines: ['Ah, a new face! Tobias Marsh. Retired miller, full-time wanderer.', "Willa said you'd turn up. Take your time, friend. Nobody hurries in Willowbrook."],
    },
    { id: 'tobias.birthday', when: [{ kind: 'birthday' }], lines: ['Another year, another wrinkle. Thank you for noticing.'] },
    { id: 'tobias.close', when: [{ kind: 'friendship', atLeast: 5 }], lines: ["Well now, here's a welcome sight."] },
    { id: 'tobias.hello', lines: ['Hello again, friend.'] },
  ],
  chats: [
    {
      id: 'tobias.story',
      once: true,
      when: [{ kind: 'friendship', atLeast: 2 }],
      lines: ['That wheel above my door has not turned since the river moved. I keep it oiled anyway.', 'A mill is a promise, you see. Even a quiet one.'],
    },
    { id: 'tobias.bridge', when: [{ kind: 'time', from: h(11), to: h(13) }], lines: ['I like the bridge at this hour. The river talks, if you let it.'] },
    { id: 'tobias.spring', when: [{ kind: 'season', is: ['spring'] }], lines: ['Strawberries in spring. My mother grew them behind the mill. I can still taste the jam.'] },
    { id: 'tobias.summer', when: [{ kind: 'season', is: ['summer'] }], lines: ['Long evenings. The best of them are spent doing nothing in particular.'] },
    { id: 'tobias.autumn', when: [{ kind: 'season', is: ['autumn'] }], lines: ['The light goes gold this time of year. It makes even an old miller sentimental.'] },
    { id: 'tobias.winter', when: [{ kind: 'season', is: ['winter'] }], lines: ['Cold hands, warm kettle. That is all a winter needs.'] },
    { id: 'tobias.default', lines: ['The valley is quieter than it used to be, and I find I do not mind.'] },
  ],
  reactions: {
    loved: ['My word. How did you know?', 'You have made an old man very happy.'],
    liked: ['Now that is a good one. Thank you, friend.'],
    neutral: ['Thank you kindly.'],
    disliked: ['Hm. Well. The thought counts.'],
    hated: ['Oh dear.'],
  },
  birthdayThanks: ["Remembering an old man's birthday. You are a good soul."],
  rewards: [
    { hearts: 2, message: "For your hens, if you have any. Or will have, I'm sure.", items: [{ id: 'chicken_feed', count: 5 }] },
    { hearts: 4, message: 'Sunflower seeds. They always turn to face the light. I find that comforting.', items: [{ id: 'sunflower_seeds', count: 5 }] },
  ],
  quests: ['sweet_on_strawberries', 'deep_down'],
};

export const HOLLIS: NpcDef = {
  id: 'hollis',
  name: 'Hollis Reed',
  role: 'Storekeeper',
  about: 'Keeps the general store and knows the price of everything, and the story behind most of it. Grew up on the edge of Whispering Wood.',
  sprite: 'hollis',
  home: STORE,
  birthday: { season: 'autumn', day: 9 },
  schedule: [
    { from: h(6), map: STORE, x: 3, y: 3, facing: 'down' }, // tidying before the doors open
    { from: h(9), map: STORE, x: 5, y: 3, facing: 'down', serves: 'general_store' }, // behind the counter
    { from: h(17), map: GREEN, x: 23, y: 25, facing: 'left' }, // a breath of air once the shop is shut
    { from: h(20), map: STORE, x: 3, y: 3, facing: 'down' },
  ],
  tastes: { loves: ['amethyst', 'quartz'], likes: ['copper_ore', 'carp', 'pumpkin'], dislikes: ['stone', 'coal'], hates: ['minnow'] },
  greetings: [
    {
      id: 'hollis.first',
      when: [{ kind: 'firstMeeting' }],
      lines: ["Welcome to Reed's! Hollis Reed. Rods, picks and a bit of everything between.", 'Willa said a new farmer had arrived. If you have fish, ore or produce to sell, I buy it, fair and square.'],
    },
    { id: 'hollis.birthday', when: [{ kind: 'birthday' }], lines: ["Don't tell me you remembered! Come in, come in."] },
    { id: 'hollis.close', when: [{ kind: 'friendship', atLeast: 6 }], lines: ["Ah, there's my best customer. The kettle's on."] },
    { id: 'hollis.hello', lines: ['What can I get you?'] },
  ],
  chats: [
    {
      id: 'hollis.story',
      once: true,
      when: [{ kind: 'friendship', atLeast: 3 }],
      lines: ['My grandfather worked the old mine, back when there was a mill that needed the stone.', 'He said the deepest floors hold crystals that glow if you hold them to a lantern. I never went to check.'],
    },
    { id: 'hollis.wood', when: [{ kind: 'quest', id: 'gone_fishing', status: 'done' }], lines: ["The trail into the wood is clear now. Mind the time down the mine: the dark doesn't know when it's night."] },
    { id: 'hollis.spring', when: [{ kind: 'season', is: ['spring'] }], lines: ['Spring is for rods. Fish are hungry after the cold.'] },
    { id: 'hollis.summer', when: [{ kind: 'season', is: ['summer'] }], lines: ['Hot weather and a slow shop. Good for reading, bad for business.'] },
    { id: 'hollis.autumn', when: [{ kind: 'season', is: ['autumn'] }], lines: ['Trout run in the autumn. June will tell you the same, at length.'] },
    { id: 'hollis.winter', when: [{ kind: 'season', is: ['winter'] }], lines: ['The stove, the shelves, the snow on the window. I could do worse.'] },
    { id: 'hollis.default', lines: ['A quiet day is a good day, in retail.'] },
  ],
  reactions: {
    loved: ["Is that... oh, it is. It's perfect. Thank you.", 'This goes on the shelf behind the counter, where I can see it.'],
    liked: ['Well, now. Much appreciated.'],
    neutral: ['Thank you. Every little helps.'],
    disliked: ["Hm. I'll find a use for it. Eventually."],
    hated: ['Is this a joke? ...Never mind. Thank you.'],
  },
  birthdayThanks: ["A gift on my birthday. Drinks are on the house. Well, a drink. Small one."],
  rewards: [
    { hearts: 2, message: 'Take these. A few coins for your trouble, and my thanks.', money: 100 },
    { hearts: 5, message: 'My grandfather\'s trick: copper ore, sold to the right buyer, pays twice. Here, start with these.', items: [{ id: 'copper_ore', count: 3 }] },
    { hearts: 8, message: 'I was saving this for someone who would use it.', items: [{ id: 'quartz', count: 2 }] },
  ],
  quests: ['gone_fishing', 'copper_for_the_store', 'make_yourself_at_home'],
};

export const JUNE: NpcDef = {
  id: 'june',
  name: 'June Hale',
  role: 'Angler',
  about: 'Came down the river on a raft one spring and never left. Talks to fish more than to people, and says the fish are better listeners.',
  sprite: 'june',
  home: RIVER,
  birthday: { season: 'winter', day: 5 },
  schedule: [
    { from: h(6), map: RIVER, x: 8, y: 13, facing: 'down' }, // the end of the dock, before the sun is up
    { from: h(12), map: RIVER, x: 12, y: 11, facing: 'up' }, // lunch on the bench
    { from: h(17), map: RIVER, x: 8, y: 13, facing: 'down' }, // back on the dock for the evening bite
  ],
  tastes: { loves: ['pike', 'trout', 'catfish'], likes: ['perch', 'carp', 'quartz'], dislikes: ['egg', 'coal'], hates: ['stone'] },
  greetings: [
    {
      id: 'june.first',
      when: [{ kind: 'firstMeeting' }],
      lines: ["Shh. Oh, you're not a fish. Hello! June Hale.", 'Silverbend is the best water in the valley, and I will not hear otherwise. Got a rod?'],
    },
    { id: 'june.birthday', when: [{ kind: 'birthday' }], lines: ['It is my birthday! The fish have not noticed, but you did.'] },
    { id: 'june.close', when: [{ kind: 'friendship', atLeast: 5 }], lines: ['There you are! The pool is biting. Probably.'] },
    { id: 'june.hello', lines: ['Quiet today. Good for fishing, bad for talking. Talk anyway.'] },
  ],
  chats: [
    {
      id: 'june.story',
      once: true,
      when: [{ kind: 'friendship', atLeast: 2 }],
      lines: ['I came down this river on a raft I built from a barn door. It sank, right there, in the wide pool.', 'I decided that was a sign, and stayed.'],
    },
    { id: 'june.night', when: [{ kind: 'time', from: 20 * 60, to: 26 * 60 }], lines: ["Catfish only bite after dark. They're shy. I respect that."] },
    { id: 'june.spring', when: [{ kind: 'season', is: ['spring'] }], lines: ['Perch in spring, silver in the shallows. Float low and wait.'] },
    { id: 'june.summer', when: [{ kind: 'season', is: ['summer'] }], lines: ["Summer is slow. The fish go deep. So do I: it's the shade."] },
    { id: 'june.autumn', when: [{ kind: 'season', is: ['autumn'] }], lines: ['Trout! Autumn and winter, cold clear water, and a steady hand.'] },
    { id: 'june.winter', when: [{ kind: 'season', is: ['winter'] }], lines: ['Warm hat, hot tea, and a float in the grey. Perfect.'] },
    { id: 'june.default', lines: ['Wait for the float to dip, then be quick. That is the whole secret.'] },
  ],
  reactions: {
    loved: ['A fish like that! You do know me. I will remember this one.', 'It goes in the bucket of honour.'],
    liked: ['Oh, lovely. Thank you!'],
    neutral: ["Thanks. I'll put it with the rest."],
    disliked: ['...Not my favourite, but it was kind of you.'],
    hated: ['Ugh. I mean. Thank you. Ugh.'],
  },
  birthdayThanks: ['The best birthday gift: someone who does not scare the fish.'],
  rewards: [
    { hearts: 2, message: 'Spare bait money. Do not tell Hollis I gave you a discount on nothing.', money: 80 },
    { hearts: 4, message: 'Chicken feed from my last trip to the stall. I have no hens, only opinions.', items: [{ id: 'chicken_feed', count: 5 }] },
    { hearts: 7, message: 'This one is for you: the best-looking stone in all of Silverbend.', items: [{ id: 'quartz', count: 1 }] },
  ],
  quests: ['the_anglers_favour'],
};

export const BRAM: NpcDef = {
  id: 'bram',
  name: 'Bram Oakley',
  role: 'Carpenter',
  about: 'Has built half the barns in three valleys, and says the other half were built wrong. Happy to build yours.',
  sprite: 'bram',
  home: GREEN,
  carpenter: true,
  birthday: { season: 'summer', day: 17 },
  schedule: [
    { from: h(6), map: GREEN, x: 27, y: 17, facing: 'left' }, // his bench of tools, before the sun is up
    { from: h(6), map: STORE, x: 2, y: 6, facing: 'right', when: 'rain' }, // in the rain he works under Hollis's roof, among the nails
    { from: h(12), map: GREEN, x: 24, y: 19, facing: 'up' }, // a sandwich in the shade of the plaza
    { from: h(12), map: STORE, x: 2, y: 6, facing: 'right', when: 'rain' },
    { from: h(15), map: GREEN, x: 27, y: 17, facing: 'left' },
    { from: h(15), map: STORE, x: 2, y: 6, facing: 'right', when: 'rain' },
  ],
  tastes: { loves: ['iron_bar', 'copper_bar', 'pumpkin_pie'], likes: ['iron_ore', 'stone', 'omelette'], dislikes: ['minnow', 'egg'], hates: ['clay_pot'] },
  greetings: [
    {
      id: 'bram.first',
      when: [{ kind: 'firstMeeting' }],
      lines: ['Bram Oakley. Carpenter. Mind the sawdust.', 'If you want something built on that empty lot on your farm, I am the man to ask. It takes money, stone and metal: honest materials.'],
    },
    { id: 'bram.birthday', when: [{ kind: 'birthday' }], lines: ['A birthday! Nobody told me. Well, now I know to expect one a year.'] },
    { id: 'bram.close', when: [{ kind: 'friendship', atLeast: 5 }], lines: ['Ah, the farmer. Pull up a crate.'] },
    { id: 'bram.hello', lines: ['Measure twice, cut once. What can I do for you?'] },
  ],
  chats: [
    {
      id: 'bram.story',
      once: true,
      when: [{ kind: 'friendship', atLeast: 2 }],
      lines: ['I built my first house at fourteen. It fell down at fifteen. It taught me more than the ten after it.', 'Glass is the hardest. It does not forgive.'],
    },
    { id: 'bram.greenhouse', when: [{ kind: 'quest', id: 'glass_and_sunshine', status: 'done' }], lines: ['How is the glasshouse? Does it hold the warmth? It should. I built it.'] },
    { id: 'bram.spring', when: [{ kind: 'season', is: ['spring'] }], lines: ['Spring is for building: the mud keeps the dust down.'] },
    { id: 'bram.summer', when: [{ kind: 'season', is: ['summer'] }], lines: ['Hot work, long days. I like it.'] },
    { id: 'bram.autumn', when: [{ kind: 'season', is: ['autumn'] }], lines: ['Finish the roofs before the leaves are down. That is the rule.'] },
    { id: 'bram.winter', when: [{ kind: 'season', is: ['winter'] }], lines: ['Not much grows in winter. Which is why a glass house is a fine idea.'] },
    { id: 'bram.default', lines: ['A good joint needs no nails. Mostly.'] },
  ],
  reactions: {
    loved: ['Now that is honest metal. Thank you!', 'I will make something fine from it.'],
    liked: ['Useful. I like useful.'],
    neutral: ['Thank you. It will find a use.'],
    disliked: ["Hm. Not for me, but it's the thought."],
    hated: ['...That belongs in a museum. Or a bin.'],
  },
  birthdayThanks: ['A gift on my birthday, and from a customer. Remarkable.'],
  rewards: [
    { hearts: 2, message: 'Take a few coins: for the company, mostly.', money: 100 },
    { hearts: 5, message: 'Spare stone from a job. Sturdy stuff.', items: [{ id: 'stone', count: 20 }] },
    { hearts: 8, message: 'A good friend deserves a good tool. Put this to use.', items: [{ id: 'iron_bar', count: 2 }] },
  ],
  quests: ['glass_and_sunshine'],
};

export const INES: NpcDef = {
  id: 'ines',
  name: 'Ines Calloway',
  role: 'Museum curator',
  about: 'Came to Willowbrook to catalogue a few old pots and has been cataloguing ever since. Knows what everything is, and says so.',
  sprite: 'ines',
  home: MUSEUM_MAP,
  birthday: { season: 'autumn', day: 21 },
  schedule: [{ from: h(6), map: MUSEUM_MAP, x: 7, y: 5, facing: 'down' }],
  tastes: { loves: ['fossil', 'old_coin', 'amethyst'], likes: ['clay_pot', 'arrowhead', 'quartz', 'rusty_key'], dislikes: ['egg', 'stone'], hates: ['omelette'] },
  greetings: [
    {
      id: 'ines.first',
      when: [{ kind: 'firstMeeting' }],
      lines: ['Welcome to the Willowbrook Museum. Ines Calloway. Please do not touch the cases. Unless you are bringing me something.', 'Fish, minerals, and things dug up from the ground: I want one of each, and I will make it worth your while.'],
    },
    { id: 'ines.birthday', when: [{ kind: 'birthday' }], lines: ['It is my birthday. I had forgotten. Thank you for remembering for me.'] },
    { id: 'ines.close', when: [{ kind: 'friendship', atLeast: 5 }], lines: ['Ah! A friend of the collection. Come in.'] },
    { id: 'ines.hello', lines: ['Quiet in here, as it should be. What have you found?'] },
  ],
  chats: [
    {
      id: 'ines.story',
      once: true,
      when: [{ kind: 'friendship', atLeast: 2 }],
      lines: ['The valley was a seabed once. That is why there are fossils in the hills, and why the river is so patient.', 'Everything we dig up is somebody’s Tuesday, long ago.'],
    },
    { id: 'ines.dig', when: [{ kind: 'quest', id: 'first_finds', status: 'done' }], lines: ['Mounds of soft earth with a pale tip: that is where to swing the hoe. Farm, bank and wood all have them.'] },
    { id: 'ines.spring', when: [{ kind: 'season', is: ['spring'] }], lines: ['The spring thaw turns up the best things. The ground gives them back.'] },
    { id: 'ines.summer', when: [{ kind: 'season', is: ['summer'] }], lines: ['It is cool in the museum all summer. That is my one boast.'] },
    { id: 'ines.autumn', when: [{ kind: 'season', is: ['autumn'] }], lines: ['Autumn: the light through the windows is perfect for the glass beads.'] },
    { id: 'ines.winter', when: [{ kind: 'season', is: ['winter'] }], lines: ['Winter visitors are the best. They stay and look properly.'] },
    { id: 'ines.default', lines: ['Everything has a place. The trick is finding it.'] },
  ],
  reactions: {
    loved: ['Oh! This is exactly what I hoped for. I could cry.', 'I shall give it a little case of its own.'],
    liked: ['How kind. It has a good shape.'],
    neutral: ['Thank you. I will find somewhere for it.'],
    disliked: ['Hmm. Not really my period, but thank you.'],
    hated: ['I... see. I will put it somewhere. Far away.'],
  },
  birthdayThanks: ['A present, in my own museum. I shall catalogue it.'],
  rewards: [
    { hearts: 3, message: 'A little something from the museum shop, which does not exist. Hence the gift.', money: 150 },
    { hearts: 6, message: 'Spare glass beads and a pot, from the back room.', items: [{ id: 'glass_bead', count: 1 }, { id: 'clay_pot', count: 1 }] },
  ],
  quests: ['first_finds', 'buried_things', 'echoes_in_stone'],
};

export const ROWAN: NpcDef = {
  id: 'rowan',
  name: 'Rowan Ash',
  role: 'Travelling merchant',
  about: 'Walks the three valleys with a cart and a ledger, and arrives wherever the roads say it is Sunday. Sells the seeds nobody else will sell out of season.',
  sprite: 'rowan',
  home: GREEN,
  birthday: { season: 'autumn', day: 3 },
  schedule: [
    { from: h(6), map: AWAY, x: 0, y: 0 }, // somewhere on the road between valleys
    { from: h(8), map: GREEN, x: 27, y: 18, facing: 'down', serves: 'merchant', days: [6] }, // market day: the cart is open on Sundays
    { from: h(18), map: AWAY, x: 0, y: 0 },
  ],
  tastes: { loves: ['old_coin', 'amethyst', 'strawberry_jam'], likes: ['baked_trout', 'fish_stew', 'quartz'], dislikes: ['coal', 'stone'], hates: ['minnow'] },
  greetings: [
    {
      id: 'rowan.first',
      when: [{ kind: 'firstMeeting' }],
      lines: ['Rowan Ash, merchant, by appointment of the road. I come through on Sundays, eight until six, rain or shine.', 'My seeds keep no calendar: they will sell you a pumpkin in spring. Do mind that the fields will not agree with them. A glasshouse would.'],
    },
    { id: 'rowan.birthday', when: [{ kind: 'birthday' }], lines: ['A birthday, on the road! I shall tell the horse.'] },
    { id: 'rowan.close', when: [{ kind: 'friendship', atLeast: 5 }], lines: ['Ah, my best customer, who has never once haggled. Fine, I will not tell anyone.'] },
    { id: 'rowan.hello', lines: ['Market day! Seeds from every season, and a buyer for whatever you have brought.'] },
  ],
  chats: [
    {
      id: 'rowan.story',
      once: true,
      when: [{ kind: 'friendship', atLeast: 2 }],
      lines: ['My grandmother sold buttons from this cart. Then thread. Then seeds, because people always need hope that fits in a pocket.', 'I have kept the wheels and changed everything else.'],
    },
    { id: 'rowan.glass', when: [{ kind: 'quest', id: 'glass_and_sunshine', status: 'done' }], lines: ['A glasshouse! Now my out-of-season seeds are a good idea instead of a bad one. Come on Sunday.'] },
    { id: 'rowan.spring', when: [{ kind: 'season', is: ['spring'] }], lines: ['Spring: everyone buys, nobody believes how far a radish can go.'] },
    { id: 'rowan.summer', when: [{ kind: 'season', is: ['summer'] }], lines: ['Summer roads are long and dusty. The cart has an awning for a reason.'] },
    { id: 'rowan.autumn', when: [{ kind: 'season', is: ['autumn'] }], lines: ['Autumn is when the valleys all sell each other pumpkins. I am above such things. I sell the seeds.'] },
    { id: 'rowan.winter', when: [{ kind: 'season', is: ['winter'] }], lines: ['Snow on the road, and a cart full of summer. I find that funny every year.'] },
    { id: 'rowan.default', lines: ['Anything you need, I can probably find. Eventually. On a Sunday.'] },
  ],
  reactions: {
    loved: ['Now this I did not expect. I will keep it with the good ledger.', 'You have an eye for the right things.'],
    liked: ['Oh, that is kind. It will travel well.'],
    neutral: ['Thank you. Everything finds a corner of the cart.'],
    disliked: ['Hm. I will give it to the horse. Thank you.'],
    hated: ['I will... accept this, with great effort.'],
  },
  birthdayThanks: ['The first birthday present of the road. I will keep it in the good ledger.'],
  rewards: [
    { hearts: 3, message: 'A little market-day bonus for a loyal customer. Do not spend it all on radishes.', money: 120 },
    { hearts: 6, message: 'Two pumpkin seeds from the bottom of the cart: the ones I keep for luck.', items: [{ id: 'pumpkin_seeds', count: 2 }] },
  ],
  quests: [],
};

export const FERN: NpcDef = {
  id: 'fern',
  name: 'Fern Alder',
  role: 'Naturalist',
  about: 'Came to the marsh to count herons and stayed to count everything else. Writes it all down, and shares it with anyone who keeps still.',
  sprite: 'fern',
  home: LODGE,
  birthday: { season: 'summer', day: 22 },
  schedule: [{ from: h(6), map: LODGE, x: 6, y: 4, facing: 'down', serves: 'lodge' }],
  tastes: { loves: ['moonbloom', 'amethyst', 'fossil'], likes: ['perch', 'sunflower', 'glass_bead', 'strawberry_jam'], dislikes: ['coal', 'egg'], hates: ['rusty_key'] },
  greetings: [
    {
      id: 'fern.first',
      when: [{ kind: 'firstMeeting' }],
      lines: ['Shh. Slowly. Good: you walk like someone who looks where they put their feet. Fern Alder.', 'I keep a record of everything rare in the valley that is shy of people. Come back with a few of them in your journal and I will make it worth your while.'],
    },
    { id: 'fern.birthday', when: [{ kind: 'birthday' }], lines: ['My birthday? The heron did not mention it. Thank you for remembering for him.'] },
    { id: 'fern.close', when: [{ kind: 'friendship', atLeast: 5 }], lines: ['There you are. Keep still, there is a kingfisher on the post behind you. Do not turn round.'] },
    { id: 'fern.hello', lines: ['Quietly, please. The marsh is listening.'] },
  ],
  chats: [
    {
      id: 'fern.story',
      once: true,
      when: [{ kind: 'friendship', atLeast: 2 }],
      lines: ['I counted forty-one herons in my first year. I know them by their walk, and I have named all of them, and I will not tell you what.', 'The shy things are shy because most people are loud. It is not complicated.'],
    },
    { id: 'fern.moonbloom', when: [{ kind: 'quest', id: 'moonlight_crop', status: 'done' }], lines: ['A moonbloom in full flower after rain is the best thing a farm can do. Better than a pumpkin. Do not tell Willa.'] },
    { id: 'fern.spring', when: [{ kind: 'season', is: ['spring'] }], lines: ['Spring: the herons come back and pretend they never left.'] },
    { id: 'fern.summer', when: [{ kind: 'season', is: ['summer'] }], lines: ['Summer mornings, sun on the shallows: that is when the kingfisher comes. Be quiet, and be early.'] },
    { id: 'fern.autumn', when: [{ kind: 'season', is: ['autumn'] }], lines: ['They say a white stag walks the heights when the autumn rain comes. I have waited eleven autumns. I will wait for the twelfth.'] },
    { id: 'fern.winter', when: [{ kind: 'season', is: ['winter'] }], lines: ['Winter is the hare on the heights, white on white. You will not see it. Then you will.'] },
    { id: 'fern.default', lines: ['Walk, do not run. Stand still, do not shuffle. That is all of it.'] },
  ],
  reactions: {
    loved: ['Oh! Oh, that is... I shall have to write this down. Thank you, truly.', 'It goes in the good drawer.'],
    liked: ['How kind. I will find a use for it, or a shelf.'],
    neutral: ['Thank you. Everything finds a place in a lodge this size.'],
    disliked: ['Hm. Not for me, but I will not waste it.'],
    hated: ['Please take it away. Gently.'],
  },
  birthdayThanks: ['A present on my birthday, and nothing was frightened in the giving. Perfect.'],
  rewards: [
    { hearts: 3, message: 'For the notebook fund. I have never spent one coin of it on anything but ink.', money: 150 },
    { hearts: 6, message: 'From my own sack: fertilizer. It works better than it smells.', items: [{ id: 'fertilizer', count: 3 }] },
    { hearts: 9, message: 'Seeds of a flower that only opens after rain. I have more than I can plant.', items: [{ id: 'moonbloom_seeds', count: 3 }] },
  ],
  quests: ['field_notes', 'a_gentle_friend', 'moonlight_crop'],
};

export const NPCS: readonly NpcDef[] = [WILLA, TOBIAS, HOLLIS, JUNE, BRAM, INES, ROWAN, FERN];
