/* 冒険の記録。右手法と先頭への通常攻撃が初期の自動行動。
 * 別の歩き方・戦い方は、冒険者レベルを上げて行動書を購入すると選べる。 */
const DATA = {
  jobs: {
    warrior: { name: '戦士', icon: '⚔️', hp: 68, mp: 12, atk: 15, def: 7, mag: 2, speed: 7, skill: 'power', skillName: '強撃', skillDesc: '力をためた一撃で、敵一体に大きな物理ダメージ。', unlock: 1 },
    knight: { name: '騎士', icon: '🛡️', hp: 82, mp: 16, atk: 11, def: 12, mag: 3, speed: 4, skill: 'guard', skillName: '守護の構え', skillDesc: '盾を掲げて仲間を守り、被害を抑える。', unlock: 2 },
    mage: { name: '魔術師', icon: '🔥', hp: 42, mp: 36, atk: 5, def: 3, mag: 17, speed: 6, skill: 'fire', skillName: '火球', skillDesc: '炎の魔法で敵一体を焼く。炎に弱い敵に有効。', unlock: 1 },
    priest: { name: '僧侶', icon: '✨', hp: 50, mp: 32, atk: 6, def: 5, mag: 13, speed: 6, skill: 'heal', skillName: '癒やしの祈り', skillDesc: '傷ついた仲間一人のHPを回復する。', unlock: 1 },
    scout: { name: '斥候', icon: '🗡️', hp: 48, mp: 20, atk: 11, def: 4, mag: 5, speed: 13, skill: 'venom', skillName: '毒刃', skillDesc: '敵一体を斬りつけ、毒で継続的に体力を奪う。', unlock: 1 },
    ranger: { name: '狩人', icon: '🏹', hp: 55, mp: 22, atk: 13, def: 5, mag: 5, speed: 11, skill: 'volley', skillName: '一斉射撃', skillDesc: '素早く矢を放ち、敵全体を攻撃する。', unlock: 2 },
    alchemist: { name: '錬金術師', icon: '⚗️', hp: 47, mp: 30, atk: 7, def: 5, mag: 14, speed: 8, skill: 'bomb', skillName: '錬金爆弾', skillDesc: '調合した爆弾で敵全体に炎のダメージ。', unlock: 3 },
    tactician: { name: '軍師', icon: '📜', hp: 54, mp: 28, atk: 8, def: 6, mag: 10, speed: 9, skill: 'rally', skillName: '奮起の号令', skillDesc: '仲間を鼓舞し、攻撃の威力を高める。', unlock: 4 }
  },
  enemies: [
    { id: 'rat', name: '洞穴ネズミ', icon: '🐀', hp: 22, atk: 7, def: 1, mag: 0, speed: 10, minDepth: 1, maxDepth: 1, ai: 'strike', weak: 'fire', resist: null, drop: 'wood', xp: 8, gold: 6, desc: '入口近くを走り回る小獣。素早いが打たれ弱い。' },
    { id: 'slime', name: '苔スライム', icon: '🟢', hp: 30, atk: 8, def: 3, mag: 2, speed: 3, minDepth: 1, maxDepth: 1, ai: 'strike', weak: 'frost', resist: 'physical', drop: 'copper', xp: 10, gold: 8, desc: '柔らかな体が刃を受け流す。冷気で動きを止めよう。' },
    { id: 'bat', name: '夜鳴きコウモリ', icon: '🦇', hp: 24, atk: 8, def: 1, mag: 3, speed: 12, minDepth: 1, maxDepth: 2, ai: 'drain', weak: 'light', resist: null, drop: 'wood', xp: 10, gold: 8, desc: '暗がりから飛びかかり、血を吸って傷を癒やす。' },
    { id: 'spider', name: '毒糸グモ', icon: '🕷️', hp: 28, atk: 9, def: 2, mag: 3, speed: 9, minDepth: 1, maxDepth: 2, ai: 'poison', weak: 'fire', resist: null, drop: 'copper', xp: 12, gold: 10, desc: '毒の牙に注意。戦いが長引くほど傷が深くなる。' },
    { id: 'beetle', name: '銅殻コガネ', icon: '🪲', hp: 35, atk: 10, def: 8, mag: 0, speed: 4, minDepth: 1, maxDepth: 2, ai: 'armor', weak: 'frost', resist: 'physical', drop: 'copper', xp: 14, gold: 12, desc: '銅色の硬い殻を持つ。物理攻撃だけでは手こずる。' },
    { id: 'goblin', name: '坑道ゴブリン', icon: '👺', hp: 38, atk: 12, def: 4, mag: 2, speed: 7, minDepth: 1, maxDepth: 2, ai: 'strike', weak: 'fire', resist: null, drop: 'iron', xp: 16, gold: 15, desc: '拾ったつるはしで襲いかかる、坑道の小さな略奪者。' },
    { id: 'skeleton', name: '錆びた骸兵', icon: '💀', hp: 44, atk: 13, def: 8, mag: 2, speed: 5, minDepth: 2, maxDepth: 3, ai: 'armor', weak: 'light', resist: 'frost', drop: 'iron', xp: 20, gold: 18, desc: '鎧をまとった古い兵士。聖なる光が骨の結び目をほどく。' },
    { id: 'wisp', name: '迷い火', icon: '🔮', hp: 36, atk: 10, def: 2, mag: 15, speed: 10, minDepth: 2, maxDepth: 3, ai: 'hex', weak: 'frost', resist: 'fire', drop: 'crystal', xp: 22, gold: 20, desc: '青い炎に宿る呪い。魔法の威力が高く、早めに倒したい。' },
    { id: 'wolf', name: '灰牙オオカミ', icon: '🐺', hp: 48, atk: 15, def: 5, mag: 0, speed: 13, minDepth: 2, maxDepth: 3, ai: 'cleave', weak: 'fire', resist: null, drop: 'steel', xp: 23, gold: 21, desc: '鋭い牙で隊列に飛び込む。複数の仲間が傷つきやすい。' },
    { id: 'fungus', name: '呪いキノコ', icon: '🍄', hp: 52, atk: 11, def: 4, mag: 12, speed: 3, minDepth: 2, maxDepth: 3, ai: 'poison', weak: 'fire', resist: 'frost', drop: 'silver', xp: 24, gold: 22, desc: '毒胞子をまき散らす大きな菌類。炎で短期決戦を。' },
    { id: 'golem', name: '鉄くずゴーレム', icon: '🗿', hp: 70, atk: 17, def: 14, mag: 1, speed: 2, minDepth: 2, maxDepth: 3, ai: 'armor', weak: 'frost', resist: 'physical', drop: 'steel', xp: 30, gold: 28, desc: '鉄片の体は頑丈だが鈍い。硬い装甲を魔法で突破しよう。' },
    { id: 'specter', name: '銀霧の亡霊', icon: '👻', hp: 54, atk: 13, def: 3, mag: 18, speed: 11, minDepth: 3, maxDepth: 3, ai: 'drain', weak: 'light', resist: 'physical', drop: 'silver', xp: 34, gold: 30, desc: '霧の体を持つ亡霊。命を吸い取られる前に光で払う。' },
    { id: 'sentinel', name: '魔銀の番兵', icon: '🤖', hp: 78, atk: 18, def: 15, mag: 8, speed: 5, minDepth: 3, maxDepth: 3, ai: 'armor', weak: 'fire', resist: 'frost', drop: 'mithril', xp: 38, gold: 35, desc: '魔銀の装甲で遺跡を守る。防御の薄い仲間には強敵。' },
    { id: 'warlock', name: '深淵の呪術師', icon: '🧙', hp: 62, atk: 14, def: 5, mag: 22, speed: 9, minDepth: 3, maxDepth: 3, ai: 'hex', weak: 'light', resist: 'fire', drop: 'crystal', xp: 40, gold: 38, desc: '深層の魔力を呪いに変える。体力より魔法攻撃が脅威。' },
    { id: 'drake', name: '黒鱗ドレイク', icon: '🐉', hp: 90, atk: 20, def: 11, mag: 14, speed: 8, minDepth: 3, maxDepth: 3, ai: 'cleave', weak: 'frost', resist: 'fire', drop: 'adamant', xp: 46, gold: 42, desc: '黒い鱗を持つ地竜。広い攻撃範囲と重い一撃に備えよう。' }
  ],
  boss: { id: 'guardian', name: '迷宮の守護者', icon: '👑', hp: 220, atk: 22, def: 12, mag: 16, speed: 7, minDepth: 3, maxDepth: 3, ai: 'cleave', weak: 'light', resist: 'physical', drop: 'adamant', xp: 160, gold: 180, desc: '迷宮の核を守る古代の巨兵。薙ぎ払いに耐え、光で封印を破れ。' },
  materials: {
    wood: { name: '硬木', rank: 1, atk: 1, def: 0, affinity: 1, cost: 10, depth: 1, desc: '軽く扱いやすい木材。最初の装備作りに。' },
    copper: { name: '銅', rank: 2, atk: 2, def: 1, affinity: 1.05, cost: 18, depth: 1, desc: '加工しやすい金属。安価な武器と防具の材料。' },
    iron: { name: '鉄', rank: 3, atk: 4, def: 2, affinity: 1.1, cost: 28, depth: 1, desc: '信頼できる強度を持つ、鍛冶の基本素材。' },
    steel: { name: '鋼', rank: 4, atk: 6, def: 3, affinity: 1.15, cost: 42, depth: 2, desc: 'よく鍛えた鉄。攻守ともに安定した性能。' },
    silver: { name: '銀', rank: 5, atk: 7, def: 4, affinity: 1.2, cost: 55, depth: 2, desc: '魔力が通りやすい金属。付与の材料にも使う。' },
    mithril: { name: 'ミスリル', rank: 6, atk: 10, def: 5, affinity: 1.3, cost: 80, depth: 3, desc: '魔法に強く抵抗する希少金属。試作では加工抵抗は未実装。' },
    adamant: { name: 'アダマンタイト', rank: 7, atk: 13, def: 7, affinity: 1.4, cost: 120, depth: 3, desc: '深層でのみ手に入る、最高の硬度を誇る金属。' },
    crystal: { name: '魔晶石', rank: 5, atk: 8, def: 4, affinity: 1.5, cost: 65, depth: 2, desc: '凝縮した魔力の結晶。属性付与と魔法装備に適する。' }
  },
  enchants: {
    flame: { name: '炎の付与', element: 'fire', stat: 5, cost: 45, materials: { copper: 2, crystal: 1 }, desc: '武器に炎を宿す。獣や菌類など炎に弱い敵に有効。' },
    frost: { name: '氷の付与', element: 'frost', stat: 5, cost: 45, materials: { iron: 2, crystal: 1 }, desc: '武器に冷気を宿す。硬い殻や炎の魔物を崩す。' },
    light: { name: '光の付与', element: 'light', stat: 7, cost: 75, materials: { silver: 2, crystal: 2 }, desc: '聖なる光を宿す。亡霊や迷宮の守護者の弱点を突く。' },
    vampire: { name: '吸命の付与', element: 'physical', stat: 3, cost: 90, materials: { mithril: 1, silver: 1, crystal: 2 }, desc: '攻撃時に生命力を吸収する。長い探索で消耗を抑える。' },
    ward: { name: '守りの付与', element: 'physical', stat: 4, cost: 60, materials: { steel: 2, crystal: 1 }, desc: '防具に守護の紋様を刻み、防御力を高める。' }
  },
  rules: [
    { id: 'left', name: '左手法の書', level: 2, cost: 35, desc: '初期の自動歩行は右手法のみ。この書で左の壁に沿う歩き方を習得する。', type: 'walk' },
    { id: 'random', name: '気まぐれ探索の書', level: 3, cost: 60, desc: '分岐で進める方向をランダムに選ぶ自動歩行を習得する。', type: 'walk' },
    { id: 'avoid', name: '既訪回避の書', level: 4, cost: 90, desc: '隣接する通路の訪問回数が少ない方向を優先する。未発見の地形や敵は参照しない。', type: 'walk' },
    { id: 'heal', name: '回復優先の書', level: 2, cost: 45, desc: '初期の自動戦闘は先頭の敵への通常攻撃のみ。この書で傷ついた仲間の回復を優先する戦い方を習得する。', type: 'battle' },
    { id: 'weak', name: '弱点看破の書', level: 3, cost: 70, desc: '敵の弱点を狙う戦い方を習得する。属性装備や特技を生かそう。', type: 'battle' },
    { id: 'retreat', name: '生還判断の書', level: 4, cost: 90, desc: '危機に陥ったとき撤退を優先する戦い方を習得する。生還も冒険の成果。', type: 'battle' }
  ]
};

