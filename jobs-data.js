/* Catalog professions occupy the same single job slot as combat professions.
   Load before game.js so saved catalog job IDs can be validated on startup. */
(() => {
  const COMBAT_MAP = {
    SK0019: { kind: 'attack', target: 'enemy', power: 1.35, mp: 2, sp: 2 },
    SK0025: { kind: 'attack', target: 'enemy', power: 1.4, mp: 2, sp: 2 },
    SK0026: { kind: 'attack', target: 'enemy', power: 1.6, mp: 4, sp: 3 },
    SK0027: { kind: 'guard', target: 'allAllies', power: 0.65, mp: 4, sp: 3 },
    SK0031: { kind: 'guard', target: 'ally', power: 0.55, mp: 3, sp: 2 },
    SK0032: { kind: 'rally', target: 'allAllies', power: 1.25, mp: 5, sp: 3 },
    SK0037: { kind: 'attack', target: 'enemy', power: 1.4, mp: 2, sp: 2 },
    SK0038: { kind: 'attack', target: 'enemy', power: 1.55, mp: 4, sp: 3 },
    SK0039: { kind: 'guard', target: 'self', power: 0.55, mp: 3, sp: 2 },
    SK0041: { kind: 'attack', target: 'enemy', power: 1.9, mp: 7, sp: 4 },
    SK0043: { kind: 'attack', target: 'enemy', power: 1.38, mp: 2, sp: 2 },
    SK0044: { kind: 'attack', target: 'enemy', power: 1.52, mp: 3, sp: 2 },
    SK0045: { kind: 'guard', target: 'self', power: 0.6, mp: 4, sp: 2 },
    SK0047: { kind: 'attack', target: 'allEnemies', power: 1.25, mp: 8, sp: 4 },
    SK0050: { kind: 'attack', target: 'enemy', power: 1.55, mp: 4, sp: 3 },
    SK0055: { kind: 'damage', target: 'enemy', element: 'fire', power: 1.45, mp: 4, sp: 1 },
    SK0056: { kind: 'guard', target: 'allAllies', power: 0.65, mp: 5, sp: 2 },
    SK0060: { kind: 'rally', target: 'allAllies', power: 1.35, mp: 9, sp: 3 },
    SK0061: { kind: 'heal', target: 'ally', power: 1.35, mp: 4, sp: 1 },
    SK0064: { kind: 'cleanse', target: 'ally', power: 1.0, mp: 5, sp: 2 },
    SK0067: { kind: 'damage', target: 'enemy', element: 'light', power: 1.4, mp: 4, sp: 2 },
    SK0068: { kind: 'damage', target: 'allEnemies', element: 'thunder', power: 1.25, mp: 6, sp: 2 },
    SK0072: { kind: 'heal', target: 'self', power: 1.5, mp: 6, sp: 2 },
    SK0073: { kind: 'rally', target: 'allAllies', power: 1.22, mp: 4, sp: 2 },
    SK0132: { kind: 'guard', target: 'allAllies', power: 0.6, mp: 6, sp: 3 },
    SK0167: { kind: 'guard', target: 'self', power: 0.5, mp: 4, sp: 2 }
  };

  for (const [id, job] of Object.entries(DATA.catalog?.jobs || {})) {
    const family = job.family || '';
    const craftSpecialist = /鍛冶|工|細工|木工|革|織|薬|錬金|付与|石/.test(family);
    const archetype = /剣|重装|槍|闘|戦士|騎士|武闘/.test(family) ? 'warrior'
      : /魔導|術|学者|付与|召喚/.test(family) ? 'mage'
      : /聖|祈|治療|詩/.test(family) ? 'priest' : 'explorer';
    const base = DATA.jobs[archetype];
    const combatSkills = (job.skills || []).map(sid => {
      const sk = DATA.catalog?.skills?.[sid], c = COMBAT_MAP[sid];
      return sk && c ? { id: sid, name: sk.name, level: sk.minLv, mp: c.mp, sp: c.sp, kind: c.kind, target: c.target, power: c.power, element: c.element || 'physical', catalog: true, desc: `${sk.effect}${sk.limit ? '（制約：' + sk.limit + '）' : ''}` } : null;
    }).filter(Boolean);
    DATA.jobs[id] = {
      ...base, attributes: { ...base.attributes },
      name: job.name, family: job.family, role: job.role,
      icon: craftSpecialist ? '⚒' : base.icon,
      base: false, catalog: true, unlock: job.minLv,
      requirements: null, skills: [], skill: null, skillName: '',
      catalogSkills: [...job.skills], catalogCombatSkills: combatSkills, craftSpecialist,
      hp: Math.round(base.hp * .85), atk: Math.max(3, base.atk - 3),
      description: job.role
    };
    DATA.jobs[id].attributes.STR = Math.max(4, base.attributes.STR - 3);
    if (craftSpecialist) DATA.jobs[id].attributes.DEX += 3;
    if (/商人|役人|芸人|詩/.test(family)) DATA.jobs[id].attributes.CHR += 3;
    if (/学者|軍師|魔/.test(family)) DATA.jobs[id].attributes.WIZ += 2;
  }
  // These lines described hidden career requirements rather than skill effects.
  for (const skill of Object.values(DATA.skills)) {
    skill.desc = (skill.desc || '').split(/(?<=[。！？])/)
      .filter(line => !/転職|派生|条件技|職業.*条件|条件.*職業/.test(line)).join('');
  }
})();
