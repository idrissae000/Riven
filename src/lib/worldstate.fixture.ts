/** A trimmed copy of a real api.warframestat.us response (2026-11-11), for the world state tests. */
export const WORLD_STATE_FIXTURE: Record<string, unknown> = {
 "cetusCycle": {
  "id": "cetusCycle1794422280000",
  "activation": "2026-11-11T17:48:00.000Z",
  "expiry": "2026-11-11T18:38:00.000Z",
  "isDay": false,
  "state": "night",
  "timeLeft": "50m 0s",
  "isCetus": true
 },
 "vallisCycle": {
  "id": "vallisCycle1794418800000",
  "activation": "2026-11-11T17:40:00.000Z",
  "expiry": "2026-11-11T18:00:08.000Z",
  "isWarm": false,
  "state": "cold"
 },
 "cambionCycle": {
  "id": "cambionCycle1794422280000",
  "activation": "2026-11-11T17:48:00.000Z",
  "expiry": "2026-11-11T18:38:00.000Z",
  "timeLeft": "50m 0s",
  "state": "vome"
 },
 "earthCycle": {
  "id": "earthCycle1794427200000",
  "activation": "2026-11-11T16:00:00.457Z",
  "expiry": "2026-11-11T20:00:00.457Z",
  "isDay": true,
  "state": "day",
  "timeLeft": "2h 12m 0s"
 },
 "zarimanCycle": {
  "id": "zarimanCycle1794422280000",
  "activation": "2026-11-11T16:08:00.000Z",
  "expiry": "2026-11-11T18:38:00.000Z",
  "isCorpus": false,
  "state": "grineer",
  "timeLeft": "49m 55s"
 },
 "duviriCycle": {
  "id": "duviriCycleenvy1794420000000",
  "activation": "2026-11-11T16:00:00.000Z",
  "expiry": "2026-11-11T18:00:00.000Z",
  "state": "envy",
  "choices": [
   {
    "category": "normal",
    "categoryKey": "EXC_NORMAL",
    "choices": [
     "Nidus",
     "Octavia",
     "Harrow"
    ]
   },
   {
    "category": "hard",
    "categoryKey": "EXC_HARD",
    "choices": [
     "Boar",
     "Gammacor",
     "Anku",
     "Gorgon",
     "Angstrum"
    ]
   }
  ]
 },
 "fissures": [
  {
   "id": "6af4a0f22bda5644886427f9",
   "activation": "2026-11-11T17:08:02.883Z",
   "expiry": "2026-11-11T19:04:41.594Z",
   "node": "Everest (Earth)",
   "missionType": "Excavation",
   "missionTypeKey": "Excavation",
   "enemy": "Grineer",
   "enemyKey": "Grineer",
   "nodeKey": "Everest (Earth)",
   "tier": "Lith",
   "tierNum": 1,
   "isStorm": false,
   "isHard": true
  },
  {
   "id": "6af4a0f22bda5644886427fa",
   "activation": "2026-11-11T17:08:02.883Z",
   "expiry": "2026-11-11T18:24:38.438Z",
   "node": "Unda (Venus)",
   "missionType": "Spy",
   "missionTypeKey": "Spy",
   "enemy": "Corpus",
   "enemyKey": "Corpus",
   "nodeKey": "Unda (Venus)",
   "tier": "Lith",
   "tierNum": 1,
   "isStorm": false,
   "isHard": true
  },
  {
   "id": "6af4953b9771f4d6e20fa8df",
   "activation": "2026-11-11T16:18:03.010Z",
   "expiry": "2026-11-11T17:54:22.408Z",
   "node": "Hydron (Sedna)",
   "missionType": "Defense",
   "missionTypeKey": "Defense",
   "enemy": "Grineer",
   "enemyKey": "Grineer",
   "nodeKey": "Hydron (Sedna)",
   "tier": "Axi",
   "tierNum": 4,
   "isStorm": false,
   "isHard": true
  },
  {
   "id": "6af4953b9771f4d6e20fa8e0",
   "activation": "2026-11-11T16:18:03.010Z",
   "expiry": "2026-11-11T17:53:22.355Z",
   "node": "Teshub (Void)",
   "missionType": "Extermination",
   "missionTypeKey": "Extermination",
   "enemy": "Orokin",
   "enemyKey": "Orokin",
   "nodeKey": "Teshub (Void)",
   "tier": "Axi",
   "tierNum": 4,
   "isStorm": false,
   "isHard": true
  },
  {
   "id": "6af4953b9771f4d6e20fa8df",
   "activation": "2026-11-11T16:18:03.010Z",
   "expiry": "2026-11-11T17:54:22.408Z",
   "node": "Hydron (Sedna)",
   "missionType": "Defense",
   "missionTypeKey": "Defense",
   "enemy": "Grineer",
   "enemyKey": "Grineer",
   "nodeKey": "Hydron (Sedna)",
   "tier": "Axi",
   "tierNum": 4,
   "isStorm": false,
   "isHard": true
  }
 ],
 "voidTraders": [
  {
   "id": "5d1e07a0a38e4a4fdd7cefca",
   "activation": "2026-11-13T14:00:00.000Z",
   "expiry": "2026-11-15T14:00:00.000Z",
   "character": "Baro Ki'Teer",
   "location": "Orcus Relay (Pluto)",
   "inventory": [],
   "psId": "5d1e07a0a38e4a4fdd7cefca0",
   "initialStart": "1970-01-01T00:00:00.000Z",
   "schedule": []
  }
 ],
 "sortie": {
  "id": "6af49b8ec62255ec30a4232b",
  "activation": "2026-11-11T17:00:00.000Z",
  "expiry": "2026-11-12T17:00:00.000Z",
  "rewardPool": "Sortie Rewards",
  "variants": [
   {
    "missionType": "Rescue",
    "missionTypeKey": "Rescue",
    "modifier": "Environmental Hazard: Fire",
    "modifierDescription": "The tileset has a fire hazard. Warframe health is halved. Meltdown Iminent.",
    "node": "Roche (Phobos)",
    "nodeKey": "Roche (Phobos)"
   },
   {
    "missionType": "Disruption",
    "missionTypeKey": "Disruption",
    "modifier": "Enemy Elemental Enhancement: Blast",
    "modifierDescription": "Enemies deal increased Blast damage and also have increased Immunity to said damage type.",
    "node": "Fossa (Venus)",
    "nodeKey": "Fossa (Venus)"
   },
   {
    "missionType": "Assassination",
    "missionTypeKey": "Assassination",
    "modifier": "Eximus Stronghold",
    "modifierDescription": "Eximus units have a much higher spawn rate in this mission. Some of their auras stack.",
    "node": "Themisto (Jupiter)",
    "nodeKey": "Themisto (Jupiter)"
   }
  ],
  "missions": [],
  "boss": "Alad V",
  "faction": "Corpus",
  "factionKey": "Corpus"
 },
 "archonHunt": {
  "id": "6af1097e05ec18308537fea6",
  "activation": "2026-11-09T00:00:00.000Z",
  "expiry": "2026-11-16T00:00:00.000Z",
  "rewardPool": "Archon Sortie Rewards",
  "variants": [],
  "missions": [
   {
    "node": "Arval (Mars)",
    "type": "Extermination"
   },
   {
    "node": "Alator (Mars)",
    "type": "Defense"
   },
   {
    "node": "War (Mars)",
    "type": "Assassination"
   }
  ],
  "boss": "Archon Amar",
  "faction": "Narmer",
  "factionKey": "Narmer"
 },
 "steelPath": {
  "currentReward": {
   "name": "Umbra Forma Blueprint",
   "cost": 150
  },
  "expiry": "2026-11-15T23:59:59.000Z",
  "rotation": [
   {
    "name": "Umbra Forma Blueprint",
    "cost": 150
   },
   {
    "name": "50,000 Kuva",
    "cost": 55
   },
   {
    "name": "Kitgun Riven Mod",
    "cost": 75
   },
   {
    "name": "3x Forma",
    "cost": 75
   },
   {
    "name": "Zaw Riven Mod",
    "cost": 75
   },
   {
    "name": "30,000 Endo",
    "cost": 150
   },
   {
    "name": "Rifle Riven Mod",
    "cost": 75
   },
   {
    "name": "Shotgun Riven Mod",
    "cost": 75
   }
  ]
 },
 "invasions": [
  {
   "id": "6af3ce7a47024b4cb8df7135",
   "activation": "2026-11-11T02:21:02.329Z",
   "node": "Helene (Saturn)",
   "nodeKey": "Helene (Saturn)",
   "desc": "Corpus Siege",
   "attacker": {
    "reward": {
     "items": [],
     "countedItems": [
      {
       "uniqueName": "/Lotus/Types/Recipes/Weapons/WeaponParts/DeraVandalStock",
       "type": "Dera Vandal Stock",
       "key": "Dera Vandal Stock",
       "count": 1
      }
     ],
     "credits": 0,
     "thumbnail": "https://cdn.warframestat.us/img/dera-vandal.png",
     "color": 6052435
    },
    "faction": "Corpus",
    "factionKey": "Corpus"
   },
   "defender": {
    "reward": {
     "items": [],
     "countedItems": [
      {
       "uniqueName": "/Lotus/Types/Recipes/Weapons/GrineerCombatKnifeSortieBlueprint",
       "type": "Sheev Blueprint",
       "key": "Sheev Blueprint",
       "count": 1
      }
     ],
     "credits": 0,
     "thumbnail": "",
     "color": 5198940
    },
    "faction": "Grineer",
    "factionKey": "Grineer"
   },
   "vsInfestation": false,
   "count": 21324,
   "requiredRuns": 44000,
   "completion": 74.23181818181818,
   "completed": false,
   "rewardTypes": [
    "vandal",
    "other"
   ]
  },
  {
   "id": "6af3c3eeef984fb9fb719cdc",
   "activation": "2026-11-11T01:41:26.653Z",
   "node": "Sao (Neptune)",
   "nodeKey": "Sao (Neptune)",
   "desc": "Grineer Offensive",
   "attacker": {
    "reward": {
     "items": [],
     "countedItems": [
      {
       "uniqueName": "/Lotus/Types/Items/Research/ChemComponent",
       "type": "Detonite Injector",
       "key": "Detonite Injector",
       "count": 3
      }
     ],
     "credits": 0,
     "thumbnail": "https://cdn.warframestat.us/img/detonite-injector.png",
     "color": 5068118
    },
    "faction": "Grineer",
    "factionKey": "Grineer"
   },
   "defender": {
    "reward": {
     "items": [],
     "countedItems": [
      {
       "uniqueName": "/Lotus/Types/Items/Research/EnergyComponent",
       "type": "Fieldron",
       "key": "Fieldron",
       "count": 3
      }
     ],
     "credits": 0,
     "thumbnail": "https://cdn.warframestat.us/img/fieldron.png",
     "color": 5068118
    },
    "faction": "Corpus",
    "factionKey": "Corpus"
   },
   "vsInfestation": false,
   "count": -10108,
   "requiredRuns": 32000,
   "completion": 34.20625,
   "completed": false,
   "rewardTypes": [
    "detonite",
    "fieldron"
   ]
  }
 ],
 "dailyDeals": [
  {
   "id": "Fist1794430800000",
   "activation": "2026-11-10T19:00:00.000Z",
   "expiry": "2026-11-11T21:00:00.000Z",
   "item": "Furax",
   "uniqueName": "/Lotus/StoreItems/Weapons/Tenno/Melee/Fist/Fist",
   "originalPrice": 125,
   "salePrice": 112,
   "total": 500,
   "sold": 3,
   "discount": 10
  }
 ],
 "nightwave": {
  "season": 18,
  "activeChallenges": [
   {
    "id": "1794441600000seasondailyaimglide",
    "activation": "2026-11-09T00:00:00.000Z",
    "expiry": "2026-11-12T00:00:00.000Z",
    "isDaily": true,
    "isElite": false,
    "desc": "Kill 15 Enemies while Aim Gliding",
    "title": "Glider",
    "reputation": 1000,
    "isPermanent": false
   },
   {
    "id": "1794528000000seasondailykillenemieswithgas",
    "activation": "2026-11-10T00:00:00.000Z",
    "expiry": "2026-11-13T00:00:00.000Z",
    "isDaily": true,
    "isElite": false,
    "desc": "Kill 150 Enemies with Gas Damage",
    "title": "Biohazard",
    "reputation": 1000,
    "isPermanent": false
   }
  ]
 }
};
